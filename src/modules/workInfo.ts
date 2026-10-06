import type { Client, Work } from "./types";

/** Funções puras da obra: dinheiro e datas. */

export const paidCents = (w: Work): number => (w.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
export const remainingCents = (w: Work): number => Math.max(0, w.plannedTotalCents - paidCents(w));
/** 0 a 100 */
export const paidPct = (w: Work): number => (w.plannedTotalCents > 0 ? Math.min(100, Math.round((paidCents(w) / w.plannedTotalCents) * 100)) : 0);

const pad = (n: number) => String(n).padStart(2, "0");
/** Date local -> "AAAA-MM-DD" */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
export const addDays = (s: string, n: number): string => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** Sugestão de término: início + dias previstos (corridos, contando o primeiro). */
export const suggestEnd = (start: string, plannedDays: number): string => addDays(start, Math.max(1, Math.ceil(plannedDays)) - 1);

/** "Começa hoje" · "Começa amanhã" · "05/10 a 07/10" · "Sem data". */
export function dateLabel(w: Work, now = Date.now()): string {
  if (!w.startDate) return "Sem data";
  const today = ymd(new Date(now));
  if (w.status === "done") return "Concluída";
  if (w.startDate === today) return "Começa hoje";
  if (w.startDate === addDays(today, 1)) return "Começa amanhã";
  if (w.startDate < today && w.endDate && w.endDate >= today) return `Até ${br(w.endDate)}`;
  return w.endDate && w.endDate !== w.startDate ? `${br(w.startDate)} a ${br(w.endDate)}` : br(w.startDate);
}

/** Obra que começa nos próximos 7 dias, ou que está acontecendo agora. */
export function isThisWeek(w: Work, now = Date.now()): boolean {
  if (w.status === "done" || !w.startDate) return false;
  const today = ymd(new Date(now));
  const end = w.endDate ?? w.startDate;
  return w.startDate <= addDays(today, 7) && end >= today;
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDay = (s: string) => s.replace(/-/g, "");

/** Evento de dia inteiro, do início ao término, com lembrete na véspera. */
export function buildWorkIcs(w: Work, client: Client | undefined, address: string, now = Date.now()): string {
  if (!w.startDate) return "";
  const end = addDays(w.endDate && w.endDate >= w.startDate ? w.endDate : w.startDate, 1); // fim é exclusivo
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medde//Obra//PT",
    "BEGIN:VEVENT",
    `UID:${w.id}@pintorpro`,
    `DTSTAMP:${new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${icsDay(w.startDate)}`,
    `DTEND;VALUE=DATE:${icsDay(end)}`,
    `SUMMARY:${icsText(`Obra${client ? ` - ${client.name}` : ""}`)}`,
    ...(address ? [`LOCATION:${icsText(address)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Obra começa amanhã",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA" (sem passar por fuso horário). */
export const dateBR = (s: string): string => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
