// Edge Function "quote-link": link público do orçamento, com aviso de quando o cliente abriu.
//  - POST (com login): o pintor publica/atualiza o link do orçamento dele ({ quoteId, snapshot }) ou o apaga ({ quoteId, revoke: true }).
//  - GET ?t=TOKEN (público): devolve o orçamento do link e conta a visualização.
//  - POST { token, action: "accept", rooms } (público): o cliente tocou em "Fechar agora". Guarda a escolha e avisa o pintor no celular.
//  - GET ?t=TOKEN&peek=1 (público): só quem fez, número e total, para a prévia do link. NÃO conta visualização nem avisa o pintor.
// Só esta função escreve na tabela shared_quotes (chave de administrador, que fica só no servidor).
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- logic.ts (junto aqui para colar no painel) ----
// Lógica pura da função "quote-link": token do link, limpeza do orçamento publicado e contagem de visualizações.

interface SharedRoom { name: string; facts: string; items: string[]; materials: string; price: string; /** Valor do ambiente em centavos (o link sempre mostra o preço por ambiente). */ priceCents?: number }
interface SharedQuote {
  v: 1;
  color: string;
  painter: { company: string; initials: string; contact: string; whatsapp: string };
  number: string;
  date: string;
  clientName: string;
  siteAddress: string;
  summary: string;
  total: string;
  days: string;
  payment: string;
  validity: string;
  /** ISO da validade, para o link avisar quando venceu. */
  validUntil: string;
  deposit: { amount: string; pct: string; link: string } | null;
  pix: { code: string; amount: string; pct: string; receiver: string } | null;
  rooms: SharedRoom[];
  showRoomPrices: boolean;
  terms: { exclusions: string[]; before: string[]; warranty: string };
  notes: string;
  materialsList?: string[];
}

const MAX_JSON = 80_000;
/** Várias aberturas seguidas (atualizar a página) contam como uma só dentro deste intervalo. */
const VIEW_WINDOW_MS = 10 * 60 * 1000;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, max)).filter(Boolean) : []);
const color = (v: unknown): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#0F3B7A");
/** Só endereços https (o botão "pagar a entrada" não pode levar a javascript: etc.). */
const httpsUrl = (v: unknown): string => {
  const t = s(v, 500);
  try { return new URL(t).protocol === "https:" ? t : ""; } catch { return ""; }
};

/** Token do link: 18 bytes aleatórios em base64url (24 caracteres, impossível de adivinhar). */
function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const isToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{24}$/.test(t);

/** Aceita o que o app mandou e devolve só os campos conhecidos, com tamanhos limitados. Devolve null se estiver vazio ou grande demais. */
function sanitizeSnapshot(raw: unknown): SharedQuote | null {
  if (!raw || typeof raw !== "object") return null;
  if (JSON.stringify(raw).length > MAX_JSON) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = raw as Record<string, any>;
  const p = (o.painter ?? {}) as Record<string, unknown>;
  const dep = o.deposit && typeof o.deposit === "object" ? (o.deposit as Record<string, unknown>) : null;
  const pix = o.pix && typeof o.pix === "object" ? (o.pix as Record<string, unknown>) : null;
  const t = (o.terms ?? {}) as Record<string, unknown>;
  const validUntil = s(o.validUntil, 40);
  const out: SharedQuote = {
    v: 1,
    color: color(o.color),
    painter: { company: s(p.company, 80), initials: s(p.initials, 3), contact: s(p.contact, 120), whatsapp: s(p.whatsapp, 30) },
    number: s(o.number, 10),
    date: s(o.date, 20),
    clientName: s(o.clientName, 80),
    siteAddress: s(o.siteAddress, 200),
    summary: s(o.summary, 600),
    total: s(o.total, 30),
    days: s(o.days, 40),
    payment: s(o.payment, 200),
    validity: s(o.validity, 60),
    validUntil: Number.isNaN(Date.parse(validUntil)) ? "" : validUntil,
    deposit: dep && httpsUrl(dep.link) ? { amount: s(dep.amount, 30), pct: s(dep.pct, 60), link: httpsUrl(dep.link) } : null,
    pix: pix && s(pix.code, 600) ? { code: s(pix.code, 600), amount: s(pix.amount, 30), pct: s(pix.pct, 60), receiver: s(pix.receiver, 60) } : null,
    rooms: (Array.isArray(o.rooms) ? o.rooms : []).slice(0, 30).map((r: Record<string, unknown>) => ({ name: s(r?.name, 60), facts: s(r?.facts, 200), items: list(r?.items, 30, 200), materials: s(r?.materials, 300), price: s(r?.price, 30), ...(typeof r?.priceCents === "number" && Number.isInteger(r.priceCents) && r.priceCents >= 0 && r.priceCents <= 10_000_000_000 ? { priceCents: r.priceCents } : {}) })),
    showRoomPrices: o.showRoomPrices === true,
    terms: { exclusions: list(t.exclusions, 30, 200), before: list(t.before, 30, 200), warranty: s(t.warranty, 400) },
    notes: s(o.notes, 800),
    ...(list(o.materialsList, 60, 120).length ? { materialsList: list(o.materialsList, 60, 120) } : {}),
  };
  return out.painter.company && out.total && out.number ? out : null;
}

/** Esta abertura deve ser contada? Não, se a anterior foi há pouco tempo. */
const shouldCountView = (lastViewedAt: string | null, now: number = Date.now()): boolean =>
  !lastViewedAt || now - Date.parse(lastViewedAt) >= VIEW_WINDOW_MS;

/** Avisar o pintor no celular? Na primeira abertura e depois só se ficou mais de 6 horas sem abrir. */
const SIX_HOURS_MS = 6 * 3600 * 1000;
const shouldNotifyView = (viewsCount: number, lastViewedAt: string | null, now: number = Date.now()): boolean =>
  viewsCount === 0 || !lastViewedAt || now - Date.parse(lastViewedAt) >= SIX_HOURS_MS;

/** O mínimo para a prévia do link (WhatsApp, redes): quem fez, número e total. Nada de itens, preços por ambiente, endereço ou Pix. */
function peekSnapshot(raw: unknown): { color: string; company: string; number: string; total: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { color?: unknown; number?: unknown; total?: unknown; painter?: { company?: unknown } };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const company = str(o.painter?.company, 80);
  if (!company) return null;
  return { color: typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : "#0F3B7A", company, number: str(o.number, 12), total: str(o.total, 30) };
}

/** "R$ 1.234,50" (sem depender de Intl no servidor). */
function brl(cents: number): string {
  const c = Math.max(0, Math.round(cents));
  const int = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${int},${String(c % 100).padStart(2, "0")}`;
}

interface Acceptance { names: string[]; all: boolean; totalLabel: string; totalCents: number | null }

/**
 * O que o cliente escolheu ao fechar. `raw` = posições dos ambientes marcados. Os nomes e os valores vêm SEMPRE do orçamento publicado:
 * nada que o cliente escreva passa. Orçamento sem ambientes = o orçamento inteiro. Devolve null se a escolha for inválida (nenhum ambiente, posição fora da lista).
 */
function pickRooms(snap: { rooms: { name: string; priceCents?: number }[]; total: string }, raw: unknown): Acceptance | null {
  const n = snap.rooms.length;
  if (n === 0) return { names: [], all: true, totalLabel: snap.total, totalCents: null };
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > n) return null;
  const idx = [...new Set(raw)];
  if (idx.some((i) => !Number.isInteger(i) || i < 0 || i >= n) || idx.length !== raw.length) return null;
  idx.sort((a, b) => a - b);
  const all = idx.length === n;
  const priced = idx.every((i) => typeof snap.rooms[i]!.priceCents === "number");
  const totalCents = priced ? idx.reduce((sum, i) => sum + snap.rooms[i]!.priceCents!, 0) : null;
  return { names: idx.map((i) => snap.rooms[i]!.name), all, totalCents, totalLabel: all ? snap.total : totalCents === null ? "" : brl(totalCents) };
}

/** Pedidos de fechar repetidos em poucos minutos (o cliente tocou duas vezes) contam como um só: o pintor recebe um aviso só. */
const ACCEPT_WINDOW_MS = 10 * 60 * 1000;
const isRepeatedAccept = (acceptedAt: string | null | undefined, now: number = Date.now()): boolean =>
  !!acceptedAt && now - Date.parse(acceptedAt) < ACCEPT_WINDOW_MS;
// ---- fim de logic.ts ----

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
    if (new URL(req.url).searchParams.get("peek") === "1") {
      const peek = peekSnapshot(data.snapshot);
      return peek ? reply(200, { peek }) : reply(404, { error: "not_found" });
    }
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

  // ---- Público: o cliente pede para fechar ----
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  if (body.action === "accept") {
    if (!isToken(body.token)) return reply(404, { error: "not_found" });
    // accepted_at só existe depois da migração 0012: sem ela, ainda avisa o pintor (sem registrar no app).
    let row = await admin.from("shared_quotes").select("snapshot, user_id, quote_id, accepted_at").eq("token", body.token).maybeSingle();
    let hasCols = true;
    if (row.error) {
      hasCols = false;
      row = await admin.from("shared_quotes").select("snapshot, user_id, quote_id").eq("token", body.token).maybeSingle() as typeof row;
    }
    if (row.error) { console.error("quote-link accept read", row.error.message); return reply(500, { error: "failed" }); }
    if (!row.data) return reply(404, { error: "not_found" });
    const snap = row.data.snapshot as { rooms?: { name: string; priceCents?: number }[]; total?: string; clientName?: string; number?: string };
    const pick = pickRooms({ rooms: snap.rooms ?? [], total: snap.total ?? "" }, body.rooms);
    if (!pick) return reply(400, { error: "bad_rooms" });
    if (isRepeatedAccept((row.data as { accepted_at?: string | null }).accepted_at)) return reply(200, { ok: true });
    if (hasCols) {
      const upd = await admin.from("shared_quotes").update({ accepted_at: new Date().toISOString(), accepted_rooms: pick.names, accepted_total_cents: pick.totalCents }).eq("token", body.token);
      if (upd.error) console.error("quote-link accept save", upd.error.message);
    }
    const what = pick.names.length === 0 ? "o orçamento inteiro" : pick.all ? "todos os ambientes" : pick.names.join(", ");
    notifyUser(row.data.user_id as string, { title: "O cliente quer fechar!", body: `${snap.clientName || "Seu cliente"} quer fechar o orçamento nº ${snap.number ?? ""}: ${what}${pick.totalLabel ? ` (${pick.totalLabel})` : ""}.`.slice(0, 160), url: `/orcamentos/${row.data.quote_id}` });
    return reply(200, { ok: true });
  }

  // ---- Pintor (com login) ----
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, { error: "unauthorized" });
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u.user) return reply(401, { error: "unauthorized" });
  const userId = u.user.id;

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
