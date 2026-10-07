// Edge Function "push": notificações no celular (Web Push).
//  - GET ?key (público): chave pública do servidor (criada sozinha na primeira vez; a privada nunca sai do servidor).
//  - POST { action: "subscribe" | "unsubscribe" | "test" } (com login do pintor).
//  - POST { action: "notify", userId, message } (só interno: exige a chave de administrador, usada por quote-link e public-page).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { MAX_SUBSCRIPTIONS_PER_USER, safeEqual, sanitizeMessage, sanitizeSubscription } from "./logic.ts";

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];
const SUBJECT = "mailto:contato@medde.com.br";

const corsFor = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0]!,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
};

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  /** Chaves do servidor: criadas uma vez e guardadas na tabela push_keys (sem acesso pelo app). */
  async function keys(): Promise<{ publicKey: string; privateKey: string }> {
    const found = await admin.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
    if (found.data) return { publicKey: found.data.public_key, privateKey: found.data.private_key };
    const fresh = webpush.generateVAPIDKeys();
    const ins = await admin.from("push_keys").upsert({ id: 1, public_key: fresh.publicKey, private_key: fresh.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    if (ins.error) throw new Error(`push_keys: ${ins.error.message}`);
    const again = await admin.from("push_keys").select("public_key, private_key").eq("id", 1).single();
    if (again.error) throw new Error(`push_keys: ${again.error.message}`);
    return { publicKey: again.data.public_key, privateKey: again.data.private_key };
  }

  async function sendTo(userId: string, message: { title: string; body: string; url: string }): Promise<number> {
    const k = await keys();
    webpush.setVapidDetails(SUBJECT, k.publicKey, k.privateKey);
    const subs = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    if (subs.error) throw new Error(`subs: ${subs.error.message}`);
    let sent = 0;
    for (const sub of subs.data ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(message), { TTL: 3600 });
        sent++;
        await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410: o aparelho cancelou ou desinstalou. Apaga para não tentar de novo.
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", sub.id);
        else console.error("push send", code ?? (e as Error).message);
      }
    }
    return sent;
  }

  try {
    if (req.method === "GET") {
      if (!new URL(req.url).searchParams.has("key")) return reply(400, { error: "bad_request" });
      return reply(200, { publicKey: (await keys()).publicKey });
    }
    if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

    // ---- Interno: outra função manda avisar um pintor ----
    if (body.action === "notify") {
      if (!safeEqual(bearer, serviceKey)) return reply(401, { error: "unauthorized" });
      const message = sanitizeMessage(body.message);
      if (typeof body.userId !== "string" || !message) return reply(400, { error: "bad_request" });
      return reply(200, { sent: await sendTo(body.userId, message) });
    }

    // ---- Pintor (com login) ----
    if (!bearer) return reply(401, { error: "unauthorized" });
    const { data: u, error: ue } = await admin.auth.getUser(bearer);
    if (ue || !u.user) return reply(401, { error: "unauthorized" });
    const userId = u.user.id;

    if (body.action === "subscribe") {
      const sub = sanitizeSubscription(body.subscription);
      if (!sub) return reply(400, { error: "bad_subscription" });
      const mine = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
      const already = await admin.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
      if (!already.data && (mine.count ?? 0) >= MAX_SUBSCRIPTIONS_PER_USER) return reply(429, { error: "too_many_devices" });
      const up = await admin.from("push_subscriptions").upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, { onConflict: "endpoint" });
      return up.error ? reply(500, { error: "failed" }) : reply(200, { ok: true });
    }
    if (body.action === "unsubscribe") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint.slice(0, 1000) : "";
      const del = await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
      return del.error ? reply(500, { error: "failed" }) : reply(200, { ok: true });
    }
    if (body.action === "test") {
      const sent = await sendTo(userId, { title: "Medde", body: "Tudo certo! As notificações estão funcionando neste celular.", url: "/configuracoes" });
      return reply(200, { sent });
    }
    return reply(400, { error: "bad_request" });
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : e);
    return reply(500, { error: "failed" });
  }
});
