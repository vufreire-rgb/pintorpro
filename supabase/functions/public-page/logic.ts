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
}
export interface RequestInput { name: string; phone: string; address: string; message: string }

/** Endereços que o app já usa (ou pode usar): nenhuma página pode ficar com eles. */
export const RESERVED = ["o", "p", "api", "admin", "app", "login", "medde", "pedidos", "orcamentos", "obras", "visitas", "clientes", "configuracoes", "onboarding", "privacidade", "termos", "excluir-conta", "redefinir-senha", "suporte", "ajuda", "www"];
export const MAX_REQUESTS_PER_PAGE_PER_DAY = 40;
export const MAX_OPEN_REQUESTS = 300;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const color = (v: unknown): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#0F3B7A");

/** "Silva Pinturas & Cia" -> "silva-pinturas-cia" */
export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
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
