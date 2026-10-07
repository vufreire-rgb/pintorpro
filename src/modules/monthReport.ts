import { remainingCents } from "./workInfo";
import type { Db } from "./types";

/** Resultado de um mês ("AAAA-MM"). Obras de treino (exemplo) ficam de fora. Tudo em centavos. */
export interface MonthReport {
  month: string;
  /** Orçamentos fechados no mês. */
  soldCents: number;
  soldCount: number;
  /** Pagamentos recebidos com data no mês. */
  receivedCents: number;
  /** Gastos lançados com data no mês. */
  spentCents: number;
  /** Recebido menos gastos do mês: o que sobrou no caixa. */
  netCents: number;
  /** O que falta receber hoje, somando todas as obras (não depende do mês escolhido). */
  toReceiveCents: number;
}

export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Mês anterior (-1) ou seguinte (+1) a "AAAA-MM". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y!, m! - 1 + by, 1));
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;

export function monthReport(db: Db, month: string): MonthReport {
  const works = db.works.filter((w) => !w.isExample);
  const exampleQuotes = new Set(db.works.filter((w) => w.isExample).map((w) => w.quoteId));
  const sold = db.quotes.filter((q) => q.status === "won" && !!q.closedAt && monthKey(new Date(q.closedAt)) === month && !exampleQuotes.has(q.id));
  const receivedCents = works.flatMap((w) => w.payments ?? []).filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amountCents, 0);
  const spentCents = works.flatMap((w) => w.expenses ?? []).filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amountCents, 0);
  return {
    month,
    soldCents: sold.reduce((s, q) => s + q.result.totals.totalCents, 0),
    soldCount: sold.length,
    receivedCents,
    spentCents,
    netCents: receivedCents - spentCents,
    toReceiveCents: works.reduce((s, w) => s + remainingCents(w), 0),
  };
}
