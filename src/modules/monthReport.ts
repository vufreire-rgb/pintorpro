import { lateCents } from "./finance";
import { remainingCents } from "./workInfo";
import { workProfit } from "./workProfit";
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
  /** Parcelas vencidas e não pagas hoje (não depende do mês escolhido). */
  lateCents: number;
  /** Obras em andamento hoje. */
  activeWorks: number;
  /** Lucro estimado dos orçamentos fechados no mês (só os que têm medidas; sem medidas não há custo). */
  estimatedProfitCents: number;
  /** Obras criadas no mês que já têm gastos lançados: lucro real × previsto. */
  trackedWorks: number;
  realProfitCents: number;
  plannedProfitCents: number;
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
  // Sem medidas (orçamento só com preço) não há custo calculado: fica fora do lucro estimado e do "previsto".
  const priceOnly = (id: string): boolean => (db.quotes.find((q) => q.id === id)?.input.rooms.length ?? 1) === 0;
  const tracked = works
    .filter((w) => w.createdAt.startsWith(month) && (w.expenses?.length ?? 0) > 0)
    .map((w) => ({ p: workProfit(w, db.quotes.find((q) => q.id === w.quoteId)), priceOnly: priceOnly(w.quoteId) }));
  return {
    month,
    soldCents: sold.reduce((s, q) => s + q.result.totals.totalCents, 0),
    soldCount: sold.length,
    receivedCents,
    spentCents,
    netCents: receivedCents - spentCents,
    toReceiveCents: works.reduce((s, w) => s + remainingCents(w), 0),
    lateCents: works.reduce((s, w) => s + lateCents(w), 0),
    activeWorks: works.filter((w) => w.status === "in_progress" || w.status === "issues").length,
    estimatedProfitCents: sold.filter((q) => q.input.rooms.length > 0).reduce((s, q) => s + q.result.totals.profitCents, 0),
    trackedWorks: tracked.length,
    realProfitCents: tracked.reduce((a, t) => a + (t.p.realProfitCents ?? t.p.realPocketCents), 0),
    plannedProfitCents: tracked.filter((t) => !t.priceOnly).reduce((a, t) => a + (t.p.realProfitCents === null ? t.p.plannedPocketCents : t.p.plannedProfitCents), 0),
  };
}
