// Edge Function "quote-link": link público do orçamento, com aviso de quando o cliente abriu.
//  - POST (com login): o pintor publica/atualiza o link do orçamento dele ({ quoteId, snapshot }) ou o apaga ({ quoteId, revoke: true }).
//  - GET ?t=TOKEN (público): devolve o orçamento do link e conta a visualização.
// Só esta função escreve na tabela shared_quotes (chave de administrador, que fica só no servidor).
import { createClient } from "npm:@supabase/supabase-js@2";
import { isToken, newToken, sanitizeSnapshot, shouldCountView, shouldNotifyView } from "./logic.ts";

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];
const MAX_LINKS_PER_USER = 2000;

/** Pede à função "push" para avisar o pintor no celular. Não atrasa a resposta e nunca derruba o fluxo principal. */
function notifyUser(userId: string, message: { title: string; body: string; url: string }): void {
  const p = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "notify", userId, message }),
  }).catch((e) => console.error("notify", e instanceof Error ? e.message : e));
  (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(p);
}

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
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // ---- Público: o cliente abre o link ----
  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("t");
    if (!isToken(t)) return reply(404, { error: "not_found" });
    const { data, error } = await admin.from("shared_quotes").select("snapshot, views_count, last_viewed_at, user_id, quote_id").eq("token", t).maybeSingle();
    if (error) { console.error("quote-link read", error.message); return reply(500, { error: "failed" }); }
    if (!data) return reply(404, { error: "not_found" });
    if (shouldCountView(data.last_viewed_at)) {
      const now = new Date().toISOString();
      if (shouldNotifyView(data.views_count ?? 0, data.last_viewed_at)) {
        const snap = data.snapshot as { clientName?: string; number?: string };
        notifyUser(data.user_id as string, { title: "O cliente abriu seu orçamento", body: `${snap.clientName || "Seu cliente"} abriu o orçamento nº ${snap.number ?? ""}.`, url: `/orcamentos/${data.quote_id}` });
      }
      const upd = await admin.from("shared_quotes").update({ views_count: (data.views_count ?? 0) + 1, last_viewed_at: now }).eq("token", t);
      if (upd.error) console.error("quote-link view", upd.error.message);
      await admin.from("shared_quotes").update({ first_viewed_at: now }).eq("token", t).is("first_viewed_at", null);
    }
    return reply(200, { snapshot: data.snapshot });
  }

  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  // ---- Pintor (com login) ----
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, { error: "unauthorized" });
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u.user) return reply(401, { error: "unauthorized" });
  const userId = u.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const quoteId = typeof body.quoteId === "string" ? body.quoteId.slice(0, 80) : "";
  if (!quoteId) return reply(400, { error: "bad_request" });

  if (body.revoke === true) {
    const del = await admin.from("shared_quotes").delete().eq("user_id", userId).eq("quote_id", quoteId);
    return del.error ? reply(500, { error: "failed" }) : reply(200, { ok: true });
  }

  const snapshot = sanitizeSnapshot(body.snapshot);
  if (!snapshot) return reply(400, { error: "bad_snapshot" });

  const existing = await admin.from("shared_quotes").select("token").eq("user_id", userId).eq("quote_id", quoteId).maybeSingle();
  if (existing.error) { console.error("quote-link find", existing.error.message); return reply(500, { error: "failed" }); }
  if (existing.data) {
    const upd = await admin.from("shared_quotes").update({ snapshot, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("quote_id", quoteId);
    return upd.error ? reply(500, { error: "failed" }) : reply(200, { token: existing.data.token });
  }
  const count = await admin.from("shared_quotes").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count.count ?? 0) >= MAX_LINKS_PER_USER) return reply(429, { error: "too_many_links" });
  const token = newToken();
  const ins = await admin.from("shared_quotes").insert({ token, user_id: userId, quote_id: quoteId, snapshot });
  if (ins.error) { console.error("quote-link insert", ins.error.message); return reply(500, { error: "failed" }); }
  return reply(200, { token });
});
