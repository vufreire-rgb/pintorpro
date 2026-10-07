// Edge Function "public-page": página pública do pintor para o cliente pedir orçamento.
//  - GET ?s=ENDERECO (público): devolve a página publicada.
//  - POST { slug, request } (público): o cliente envia um pedido.
//  - POST { action: "publish" | "disable", ... } (com login): o pintor publica, atualiza ou desliga a página dele.
// Só esta função escreve nas tabelas public_pages e quote_requests (chave de administrador, só no servidor).
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- logic.ts (junto aqui para colar no painel) ----
// Lógica pura da função "public-page": endereço da página do pintor, limpeza do que ele publica e dos pedidos dos clientes.

interface PageSnapshot {
  v: 1;
  color: string;
  company: string;
  initials: string;
  city: string;
  whatsapp: string;
  headline: string;
  about: string;
  services: string[];
}
interface RequestInput { name: string; phone: string; address: string; message: string }

/** Endereços que o app já usa (ou pode usar): nenhuma página pode ficar com eles. */
const RESERVED = ["o", "p", "api", "admin", "app", "login", "medde", "pedidos", "orcamentos", "obras", "visitas", "clientes", "configuracoes", "onboarding", "privacidade", "termos", "excluir-conta", "redefinir-senha", "suporte", "ajuda", "www"];
const MAX_REQUESTS_PER_PAGE_PER_DAY = 40;
const MAX_OPEN_REQUESTS = 300;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const color = (v: unknown): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#0F3B7A");

/** "Silva Pinturas & Cia" -> "silva-pinturas-cia" */
function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}
const isSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v) && !v.includes("--") && !RESERVED.includes(v);

function sanitizePage(raw: unknown): PageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: PageSnapshot = {
    v: 1,
    color: color(o.color),
    company: s(o.company, 80),
    initials: s(o.initials, 3),
    city: s(o.city, 60),
    whatsapp: s(o.whatsapp, 30),
    headline: s(o.headline, 120),
    about: s(o.about, 600),
    services: (Array.isArray(o.services) ? o.services : []).slice(0, 12).map((x) => s(x, 60)).filter(Boolean),
  };
  return out.company ? out : null;
}

/** Pedido do cliente. "spam" = o campo escondido foi preenchido (só robô faz isso). null = faltam dados. */
function sanitizeRequest(raw: unknown): RequestInput | "spam" | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.hp === "string" && o.hp.trim() !== "") return "spam";
  const phone = s(o.phone, 30).replace(/\D/g, "");
  const name = s(o.name, 80);
  if (name.length < 2 || phone.length < 10 || phone.length > 13) return null;
  return { name, phone, address: s(o.address, 200), message: s(o.message, 1000) };
}
// ---- fim de logic.ts ----

/** Pede à função "push" para avisar o pintor no celular. Não atrasa a resposta e nunca derruba o fluxo principal. */
function notifyUser(userId: string, message: { title: string; body: string; url: string }): void {
  const p = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "notify", userId, message }),
  }).catch((e) => console.error("notify", e instanceof Error ? e.message : e));
  (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(p);
}

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];

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

  // ---- Público: abrir a página ----
  if (req.method === "GET") {
    const slug = new URL(req.url).searchParams.get("s");
    if (!isSlug(slug)) return reply(404, { error: "not_found" });
    const { data, error } = await admin.from("public_pages").select("snapshot").eq("slug", slug).eq("enabled", true).maybeSingle();
    if (error) { console.error("public-page read", error.message); return reply(500, { error: "failed" }); }
    return data ? reply(200, { snapshot: data.snapshot }) : reply(404, { error: "not_found" });
  }
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }

  // ---- Público: o cliente envia um pedido ----
  if (body.request !== undefined) {
    if (!isSlug(body.slug)) return reply(404, { error: "not_found" });
    const r = sanitizeRequest(body.request);
    if (r === "spam") return reply(200, { ok: true }); // robô: finge que deu certo e não guarda nada
    if (!r) return reply(400, { error: "bad_request" });
    const page = await admin.from("public_pages").select("user_id").eq("slug", body.slug).eq("enabled", true).maybeSingle();
    if (page.error) { console.error("public-page find", page.error.message); return reply(500, { error: "failed" }); }
    if (!page.data) return reply(404, { error: "not_found" });
    const uid = page.data.user_id as string;
    const since = new Date(Date.now() - 86400000).toISOString();
    const recent = await admin.from("quote_requests").select("phone", { count: "exact" }).eq("user_id", uid).gte("created_at", since);
    if (recent.error) { console.error("public-page recent", recent.error.message); return reply(500, { error: "failed" }); }
    if ((recent.count ?? 0) >= MAX_REQUESTS_PER_PAGE_PER_DAY) return reply(429, { error: "busy" });
    if ((recent.data ?? []).some((x: { phone: string }) => x.phone === r.phone)) return reply(200, { ok: true }); // mesmo telefone hoje: já recebemos
    const open = await admin.from("quote_requests").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "new");
    if ((open.count ?? 0) >= MAX_OPEN_REQUESTS) return reply(429, { error: "busy" });
    const ins = await admin.from("quote_requests").insert({ user_id: uid, ...r });
    if (ins.error) { console.error("public-page insert", ins.error.message); return reply(500, { error: "failed" }); }
    // Só os 5 primeiros pedidos do dia viram aviso no celular: se alguém mandar pedidos falsos em massa, o celular do pintor não vira alvo de spam.
    if ((recent.count ?? 0) < 5) notifyUser(uid, { title: "Novo pedido de orçamento", body: `${r.name}${r.message ? `: ${r.message.slice(0, 90)}` : ""}`, url: "/pedidos" });
    return reply(200, { ok: true });
  }

  // ---- Pintor (com login) ----
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, { error: "unauthorized" });
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u.user) return reply(401, { error: "unauthorized" });
  const userId = u.user.id;

  if (body.action === "disable") {
    const r = await admin.from("public_pages").update({ enabled: false, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return r.error ? reply(500, { error: "failed" }) : reply(200, { ok: true });
  }
  if (body.action === "publish") {
    if (!isSlug(body.slug)) return reply(400, { error: "bad_slug" });
    const snapshot = sanitizePage(body.snapshot);
    if (!snapshot) return reply(400, { error: "bad_snapshot" });
    const taken = await admin.from("public_pages").select("user_id").eq("slug", body.slug).maybeSingle();
    if (taken.error) { console.error("public-page taken", taken.error.message); return reply(500, { error: "failed" }); }
    if (taken.data && taken.data.user_id !== userId) return reply(409, { error: "slug_taken" });
    const up = await admin.from("public_pages").upsert({ user_id: userId, slug: body.slug, enabled: true, snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (up.error) { console.error("public-page upsert", up.error.message); return reply(up.error.code === "23505" ? 409 : 500, { error: up.error.code === "23505" ? "slug_taken" : "failed" }); }
    return reply(200, { ok: true, slug: body.slug });
  }
  return reply(400, { error: "bad_request" });
});
