import type { Db, Quote, Work } from "./types";

/** Quantos dias depois do fim da validade um orçamento sem resposta vira "Perdido" sozinho. */
export const AUTO_LOST_AFTER_DAYS = 14;
const DAY = 86400000;

const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const paidCents = (w: Work) => (w.payments ?? []).reduce((s, p) => s + p.amountCents, 0);

/** Orçamento aberto que passou muito da validade, sem ninguém mexer: dá para considerar perdido. */
export function shouldAutoLose(q: Quote, now = Date.now()): boolean {
  return q.status === "open" && Date.parse(q.validUntil) + AUTO_LOST_AFTER_DAYS * DAY < now;
}

/**
 * Situação da obra que o app decide sozinho (nunca mexe em "Pendências" nem em obra concluída):
 * - Agendada → Em andamento: chegou a data de início, ou já entrou pagamento/gasto, ou há dias trabalhados.
 * - Em andamento → Concluída: tudo foi pago e a data de término já passou (a não ser que a pessoa tenha reaberto de propósito).
 */
export function autoWorkStatus(w: Work, today: string): Work["status"] {
  let status = w.status;
  if (status === "scheduled") {
    const started = (!!w.startDate && w.startDate <= today) || !!w.payments?.length || !!w.expenses?.length || (w.daysWorked ?? 0) > 0;
    if (started) status = "in_progress";
  }
  if (status === "in_progress" && !w.keepOpen && w.plannedTotalCents > 0 && paidCents(w) >= w.plannedTotalCents && !!w.endDate && w.endDate <= today) status = "done";
  return status;
}

/** Aplica as regras automáticas. Devolve o MESMO objeto quando nada muda (para não regravar à toa). */
export function applyAutoStatus(db: Db, now = Date.now()): Db {
  const today = localDay(now);
  let changed = false;
  const quotes = db.quotes.map((q) => {
    if (!shouldAutoLose(q, now)) return q;
    changed = true;
    return { ...q, status: "lost" as const, autoClosed: true, closedAt: new Date(now).toISOString() };
  });
  const works = db.works.map((w) => {
    const status = autoWorkStatus(w, today);
    if (status === w.status) return w;
    changed = true;
    return { ...w, status };
  });
  return changed ? { ...db, quotes, works } : db;
}
