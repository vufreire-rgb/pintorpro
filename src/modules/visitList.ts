import type { Client, Company, Visit } from "./types";

export type VisitState = "scheduled" | "late" | "done";
export type VisitFilter = "all" | "todo" | "quoted" | "scheduled";

const HOUR = 3600_000;

/** Agendada: ainda não começou. Atrasada: passou mais de 1 hora do horário e não começou. */
export function visitState(v: Visit, now = Date.now()): VisitState {
  if (v.scheduledAt && !v.startedAt) return Date.parse(v.scheduledAt) < now - HOUR ? "late" : "scheduled";
  return "done";
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export interface VisitFilters {
  query?: string;
  filter?: VisitFilter;
}

/** Busca por cliente, telefone, endereço, observações e nomes de ambientes. Agendadas primeiro (mais próximas antes); depois as mais recentes. */
export function filterVisits(visits: Visit[], clients: Client[], { query = "", filter = "all" }: VisitFilters = {}, now = Date.now()): Visit[] {
  const q = norm(query.trim());
  const byId = new Map(clients.map((c) => [c.id, c]));
  const match = (v: Visit) => {
    const st = visitState(v, now);
    if (filter === "scheduled" && st === "done") return false;
    if (filter === "todo" && (st !== "done" || v.quoteId)) return false;
    if (filter === "quoted" && !v.quoteId) return false;
    if (!q) return true;
    const c = v.clientId ? byId.get(v.clientId) : undefined;
    const hay = norm([c?.name, c?.phone, v.siteAddress, v.notes, ...(v.rooms ?? []).map((r) => r.name)].filter(Boolean).join(" "));
    return hay.includes(q);
  };
  const list = visits.filter(match);
  const when = (v: Visit) => Date.parse(v.scheduledAt && !v.startedAt ? v.scheduledAt : v.createdAt);
  return list.sort((a, b) => {
    const sa = visitState(a, now) !== "done", sb = visitState(b, now) !== "done";
    if (sa !== sb) return sa ? -1 : 1;
    return sa ? when(a) - when(b) : when(b) - when(a);
  });
}

export const countByFilter = (visits: Visit[], now = Date.now()) => ({
  all: visits.length,
  todo: visits.filter((v) => visitState(v, now) === "done" && !v.quoteId).length,
  quoted: visits.filter((v) => !!v.quoteId).length,
  scheduled: visits.filter((v) => visitState(v, now) !== "done").length,
});

/** Aba que a lista de visitas abre: a primeira, na ordem das abas, que tem alguma visita (se nenhuma tiver, "scheduled"). */
export function firstFilledFilter(visits: Visit[], now = Date.now()): "scheduled" | "todo" | "quoted" {
  const c = countByFilter(visits, now);
  return c.scheduled > 0 ? "scheduled" : c.todo > 0 ? "todo" : c.quoted > 0 ? "quoted" : "scheduled";
}

const startOfDay = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();

/** "Hoje, 14:30" · "Amanhã, 09:00" · "qui., 10/10, 09:00". */
export function whenLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((startOfDay(d.getTime()) - startOfDay(now)) / 86400000);
  if (days === 0) return `Hoje, ${time}`;
  if (days === 1) return `Amanhã, ${time}`;
  if (days === -1) return `Ontem, ${time}`;
  const day = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `${day}, ${time}`;
}

/** Valor para <input type="datetime-local"> (hora local) a partir de um ISO. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Converte "2026-10-10T09:00" (hora local) em ISO UTC. */
export const fromLocalInput = (value: string): string => new Date(value).toISOString();

// ---- contato ----
const digits = (s: string) => s.replace(/\D/g, "");
export const telUrl = (phone: string): string => `tel:${digits(phone)}`;
export const waUrl = (phone: string, text = ""): string => {
  const n = digits(phone);
  return `https://wa.me/${n.length <= 11 ? "55" + n : n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
/** Abre no ponto exato se houver coordenadas; senão procura pelo endereço escrito. */
export const mapsUrl = (address: string, loc?: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/search/?api=1&query=${loc ? `${loc.lat},${loc.lng}` : encodeURIComponent(address)}`;

export function confirmationText(v: Visit, client: Client | undefined, company: Company | null, now = Date.now()): string {
  const first = client?.name.split(" ")[0] ?? "";
  const when = v.scheduledAt ? whenLabel(v.scheduledAt, now).toLowerCase() : "";
  return `Olá${first ? " " + first : ""}! Confirmando nossa visita ${when}${v.siteAddress ? ` em ${v.siteAddress}` : ""}. Qualquer imprevisto, me avise.${company?.name ? ` — ${company.name}` : ""}`;
}

// ---- calendário (.ics): abre direto no calendário do celular, com alarme 1 hora antes ----
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(v: Visit, client: Client | undefined, now = Date.now()): string {
  if (!v.scheduledAt) return "";
  const start = Date.parse(v.scheduledAt);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medde//Visita//PT",
    "BEGIN:VEVENT",
    `UID:${v.id}@pintorpro`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(start + HOUR)}`,
    `SUMMARY:${icsText(`Visita${client ? ` - ${client.name}` : ""}`)}`,
    ...(v.siteAddress ? [`LOCATION:${icsText(v.siteAddress)}`] : []),
    ...(v.notes ? [`DESCRIPTION:${icsText(v.notes)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Visita em 1 hora",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
