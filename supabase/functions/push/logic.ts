// Lógica pura da função "push": limpeza da inscrição do aparelho, texto das notificações e comparação segura de chaves.

export interface PushSub { endpoint: string; p256dh: string; auth: string }
export interface PushMessage { title: string; body: string; url: string }

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const b64url = (v: unknown, max: number): string => { const t = s(v, max); return /^[A-Za-z0-9_-]+={0,2}$/.test(t) ? t : ""; };

/** Inscrição que o navegador gera (PushSubscription.toJSON). Só aceita endereços https e chaves no formato certo. */
export function sanitizeSubscription(raw: unknown): PushSub | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = s(o.endpoint, 1000);
  try { if (new URL(endpoint).protocol !== "https:") return null; } catch { return null; }
  const p256dh = b64url(o.keys?.p256dh, 200);
  const auth = b64url(o.keys?.auth, 100);
  return p256dh && auth ? { endpoint, p256dh, auth } : null;
}

/** Texto curto e endereço dentro do próprio app (começa com "/"): ninguém consegue mandar o pintor para outro site. */
export function sanitizeMessage(raw: unknown): PushMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = s(o.title, 80);
  const body = s(o.body, 160);
  const url = typeof o.url === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(o.url) ? o.url.slice(0, 200) : "/";
  return title ? { title, body, url } : null;
}

/** Comparação em tempo constante (para conferir a chave de administrador que vem no cabeçalho). */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** O cliente abriu o link: avisa na primeira abertura e depois só se ficou mais de 6 horas sem abrir. */
export const SIX_HOURS_MS = 6 * 3600 * 1000;
export const shouldNotifyView = (viewsCount: number, lastViewedAt: string | null, now: number = Date.now()): boolean =>
  viewsCount === 0 || !lastViewedAt || now - Date.parse(lastViewedAt) >= SIX_HOURS_MS;

export const MAX_SUBSCRIPTIONS_PER_USER = 8;
