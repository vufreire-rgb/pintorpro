import type { Quote } from "./types";

const DAY = 86_400_000;
/** Depois de quantos dias sem resposta o app sugere lembrar o cliente. */
export const FOLLOW_UP_AFTER_DAYS = 3;

/** Dias desde que o orçamento foi feito (ou refeito). */
export const daysWaiting = (q: Pick<Quote, "createdAt" | "revisedAt">, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - Date.parse(q.revisedAt ?? q.createdAt)) / DAY));

/** Orçamento aberto há alguns dias, sem fechar nem perder: vale lembrar o cliente. */
export const needsFollowUp = (q: Pick<Quote, "status" | "createdAt" | "revisedAt">, now: number = Date.now()): boolean =>
  q.status === "open" && daysWaiting(q, now) >= FOLLOW_UP_AFTER_DAYS;

/** Mensagem pronta para o WhatsApp. Usa só o primeiro nome. */
export function followUpMessage(clientName: string, quoteNumber: number, painterName: string): string {
  const first = clientName.trim().split(/\s+/)[0] ?? "";
  return `Oi${first ? ` ${first}` : ""}, tudo bem? Aqui é da ${painterName}. Conseguiu ver o orçamento nº ${quoteNumber}? Se tiver qualquer dúvida, é só me falar.`;
}
