// Lógica pura da função "public-page": endereço da página do pintor, limpeza do que ele publica e dos pedidos dos clientes.

export interface PageSnapshot {
  v: 1;
  color: string;
  company: string;
  initials: string;
  city: string;
  whatsapp: string;
  headline: string;
  about: string;
  services: string[];
  /** Foto de perfil (JPEG em data URL, já reduzida pelo app). */
  avatar?: string;
  /** Fotos de trabalhos feitos (JPEG em data URL, já reduzidas pelo app). */
  photos?: string[];
}
export interface RequestInput { name: string; phone: string; address: string; message: string }

/** Endereços que o app já usa (ou pode usar): nenhuma página pode ficar com eles. */
export const RESERVED = ["o", "p", "api", "admin", "app", "login", "medde", "pedidos", "orcamentos", "obras", "visitas", "clientes", "configuracoes", "onboarding", "privacidade", "termos", "excluir-conta", "redefinir-senha", "suporte", "ajuda", "www"];
export const MAX_REQUESTS_PER_PAGE_PER_DAY = 40;
export const MAX_OPEN_REQUESTS = 300;
/** Mesmo telefone: no máximo este tanto de pedidos por dia. */
export const MAX_REQUESTS_PER_PHONE_PER_DAY = 3;
export const MAX_PHOTOS = 6;
/** Tamanho máximo (em caracteres do data URL) da foto de perfil e de cada foto de trabalho. */
export const MAX_AVATAR_CHARS = 80_000;
export const MAX_PHOTO_CHARS = 260_000;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Só aceita JPEG em data URL, base64 puro e dentro do limite. O resto é descartado. */
export const jpegDataUrl = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.length <= max && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v) ? v : undefined;
const color = (v: unknown): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#0F3B7A");

/** "Silva Pinturas & Cia" -> "silva-pinturas-cia" */
export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}
export const isSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v) && !v.includes("--") && !RESERVED.includes(v);

export function sanitizePage(raw: unknown): PageSnapshot | null {
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
  const avatar = jpegDataUrl(o.avatar, MAX_AVATAR_CHARS);
  if (avatar) out.avatar = avatar;
  const photos = (Array.isArray(o.photos) ? o.photos : []).map((x) => jpegDataUrl(x, MAX_PHOTO_CHARS)).filter((x): x is string => !!x).slice(0, MAX_PHOTOS);
  if (photos.length) out.photos = photos;
  return out.company ? out : null;
}

/** Pedido do cliente. "spam" = o campo escondido foi preenchido (só robô faz isso). null = faltam dados. */
export function sanitizeRequest(raw: unknown): RequestInput | "spam" | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.hp === "string" && o.hp.trim() !== "") return "spam";
  const phone = s(o.phone, 30).replace(/\D/g, "");
  const name = s(o.name, 80);
  if (name.length < 2 || phone.length < 10 || phone.length > 13) return null;
  return { name, phone, address: s(o.address, 200), message: s(o.message, 1000) };
}

/**
 * Pedido repetido? Só descarta (sem avisar o pintor de novo) quando o mesmo telefone já mandou o MESMO texto hoje,
 * ou quando já mandou 3 pedidos hoje. Pedido novo do mesmo cliente, com outro texto, passa.
 */
export function isRepeatedRequest(recent: { phone: string; message?: string | null; address?: string | null }[], r: RequestInput): boolean {
  const same = recent.filter((x) => x.phone === r.phone);
  if (same.length >= MAX_REQUESTS_PER_PHONE_PER_DAY) return true;
  const norm = (t?: string | null) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return same.some((x) => norm(x.message) === norm(r.message) && norm(x.address) === norm(r.address));
}
