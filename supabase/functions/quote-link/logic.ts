// Lógica pura da função "quote-link": token do link, limpeza do orçamento publicado e contagem de visualizações.

export interface SharedRoom { name: string; facts: string; items: string[]; materials: string; price: string }
export interface SharedQuote {
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
}

const MAX_JSON = 80_000;
/** Várias aberturas seguidas (atualizar a página) contam como uma só dentro deste intervalo. */
export const VIEW_WINDOW_MS = 10 * 60 * 1000;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, max)).filter(Boolean) : []);
const color = (v: unknown): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#0F3B7A");
/** Só endereços https (o botão "pagar a entrada" não pode levar a javascript: etc.). */
const httpsUrl = (v: unknown): string => {
  const t = s(v, 500);
  try { return new URL(t).protocol === "https:" ? t : ""; } catch { return ""; }
};

/** Token do link: 18 bytes aleatórios em base64url (24 caracteres, impossível de adivinhar). */
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const isToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{24}$/.test(t);

/** Aceita o que o app mandou e devolve só os campos conhecidos, com tamanhos limitados. Devolve null se estiver vazio ou grande demais. */
export function sanitizeSnapshot(raw: unknown): SharedQuote | null {
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
    rooms: (Array.isArray(o.rooms) ? o.rooms : []).slice(0, 30).map((r: Record<string, unknown>) => ({ name: s(r?.name, 60), facts: s(r?.facts, 200), items: list(r?.items, 30, 200), materials: s(r?.materials, 300), price: s(r?.price, 30) })),
    showRoomPrices: o.showRoomPrices === true,
    terms: { exclusions: list(t.exclusions, 30, 200), before: list(t.before, 30, 200), warranty: s(t.warranty, 400) },
    notes: s(o.notes, 800),
  };
  return out.painter.company && out.total && out.number ? out : null;
}

/** Esta abertura deve ser contada? Não, se a anterior foi há pouco tempo. */
export const shouldCountView = (lastViewedAt: string | null, now: number = Date.now()): boolean =>
  !lastViewedAt || now - Date.parse(lastViewedAt) >= VIEW_WINDOW_MS;

/** Avisar o pintor no celular? Na primeira abertura e depois só se ficou mais de 6 horas sem abrir. */
export const SIX_HOURS_MS = 6 * 3600 * 1000;
export const shouldNotifyView = (viewsCount: number, lastViewedAt: string | null, now: number = Date.now()): boolean =>
  viewsCount === 0 || !lastViewedAt || now - Date.parse(lastViewedAt) >= SIX_HOURS_MS;

/** O mínimo para a prévia do link (WhatsApp, redes): quem fez, número e total. Nada de itens, preços por ambiente, endereço ou Pix. */
export function peekSnapshot(raw: unknown): { color: string; company: string; number: string; total: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { color?: unknown; number?: unknown; total?: unknown; painter?: { company?: unknown } };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const company = str(o.painter?.company, 80);
  if (!company) return null;
  return { color: typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : "#0F3B7A", company, number: str(o.number, 12), total: str(o.total, 30) };
}
