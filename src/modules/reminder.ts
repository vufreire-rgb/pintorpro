/** Lembrete recorrente de "revisar orçamentos", entregue como evento de calendário (.ics) que apita no celular. */

export interface ReviewReminder {
  time: string; // "HH:MM"
  days: number[]; // 0=domingo … 6=sábado
}

export const DEFAULT_REMINDER: ReviewReminder = { time: "08:00", days: [1, 2, 3, 4, 5] };

export const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ICS_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** "Todo dia às 08:00" · "Seg a Sex às 08:00" · "Seg, Qua às 07:30". */
export function reminderLabel(r: ReviewReminder): string {
  const days = [...new Set(r.days)].sort((a, b) => a - b);
  let when: string;
  if (days.length === 7) when = "Todo dia";
  else if (days.join() === "1,2,3,4,5") when = "Seg a Sex";
  else when = days.map((d) => DAY_SHORT[d]).join(", ");
  return `${when} às ${r.time}`;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;

/** Primeira ocorrência: a partir de agora, no primeiro dia marcado cuja hora ainda não passou. */
export function firstOccurrence(r: ReviewReminder, now = new Date()): Date {
  const [h, m] = r.time.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m);
    if (r.days.includes(d.getDay()) && d.getTime() > now.getTime()) return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m);
}

/** Hora local "flutuante" (sem fuso): o calendário usa o fuso do aparelho. UID fixo: importar de novo substitui o anterior. */
export function buildReviewIcs(r: ReviewReminder, appUrl: string, now = new Date()): string {
  const start = firstOccurrence(r, now);
  const end = new Date(start.getTime() + 15 * 60_000);
  const days = [...new Set(r.days)].sort((a, b) => a - b);
  const rule = days.length === 7 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${days.map((d) => ICS_DAY[d]).join(",")}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medde//Revisao//PT",
    "BEGIN:VEVENT",
    "UID:revisao-orcamentos@pintorpro",
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `RRULE:${rule}`,
    "SUMMARY:Revisar orçamentos e visitas",
    `DESCRIPTION:Abra o app e veja quem ainda não respondeu: ${appUrl}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0S",
    "ACTION:DISPLAY",
    "DESCRIPTION:Hora de revisar seus orçamentos",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
