import type { ExpenseKind, Quote, Work } from "./types";

export const EXPENSE_LABEL: Record<ExpenseKind, string> = { material: "Material", ajudante: "Ajudante", transporte: "Transporte", outro: "Outros" };

export interface WorkProfit {
  /** Valor combinado com o cliente. */
  revenueCents: number;
  /** Previsto no orçamento. */
  plannedSpendCents: number; // material + extras (dinheiro que sai do bolso)
  plannedDiariaCents: number; // a diária do próprio pintor
  plannedPocketCents: number; // sobra no bolso
  plannedProfitCents: number; // lucro depois da diária
  /** Real, a partir dos gastos lançados. */
  spentCents: number;
  spentByKind: Record<ExpenseKind, number>;
  realPocketCents: number;
  /** Diária real (dias trabalhados × diária por dia prevista); null enquanto os dias não foram informados. */
  realDiariaCents: number | null;
  realProfitCents: number | null;
  /** Real − previsto, depois da diária quando possível, senão no bolso. Positivo = deu mais do que o previsto. */
  deltaCents: number;
  hasExpenses: boolean;
}

/**
 * Compara o lucro previsto no orçamento com o que sobrou de fato.
 * Base: valor combinado (o que falta receber não muda o lucro da obra).
 * A diária por dia vem do próprio orçamento (mão de obra prevista ÷ dias previstos).
 */
export function workProfit(w: Work, q: Quote | undefined): WorkProfit {
  const t = q?.result.totals;
  const plannedDiariaCents = t?.laborCostCents ?? 0;
  const plannedSpendCents = t ? t.costCents - t.laborCostCents : Math.max(0, w.plannedCostCents - plannedDiariaCents);
  const revenueCents = w.plannedTotalCents;
  const plannedPocketCents = revenueCents - plannedSpendCents;
  const plannedProfitCents = plannedPocketCents - plannedDiariaCents;

  const spentByKind: Record<ExpenseKind, number> = { material: 0, ajudante: 0, transporte: 0, outro: 0 };
  for (const e of w.expenses ?? []) spentByKind[e.kind] += e.amountCents;
  const spentCents = Object.values(spentByKind).reduce((a, b) => a + b, 0);
  const realPocketCents = revenueCents - spentCents;

  const perDay = w.plannedDays > 0 ? plannedDiariaCents / w.plannedDays : 0;
  const realDiariaCents = w.daysWorked && w.daysWorked > 0 ? Math.round(w.daysWorked * perDay) : null;
  const realProfitCents = realDiariaCents === null ? null : realPocketCents - realDiariaCents;
  const deltaCents = realProfitCents === null ? realPocketCents - plannedPocketCents : realProfitCents - plannedProfitCents;
  return { revenueCents, plannedSpendCents, plannedDiariaCents, plannedPocketCents, plannedProfitCents, spentCents, spentByKind, realPocketCents, realDiariaCents, realProfitCents, deltaCents, hasExpenses: (w.expenses ?? []).length > 0 };
}

/** Frase simples sobre o que os números dizem do orçamento; null se ainda não há o que dizer. */
export function profitHint(p: WorkProfit, plannedMaterialCents: number): string | null {
  if (!p.hasExpenses) return null;
  const materialOver = p.spentByKind.material - plannedMaterialCents;
  const gap = Math.abs(p.deltaCents);
  const tol = Math.max(5000, Math.round(Math.abs(p.realProfitCents === null ? p.plannedPocketCents : p.plannedProfitCents) * 0.1));
  if (gap <= tol) return "O orçamento ficou certo: o lucro real está perto do previsto.";
  if (p.deltaCents > 0) return "Sobrou mais do que o previsto. Seu orçamento está com folga.";
  if (materialOver > 0 && materialOver >= gap / 2) return "Você gastou mais material do que o orçamento previa. Vale conferir o rendimento da tinta nas configurações.";
  return "Sobrou menos do que o previsto. Vale rever o preço ou os dias dos próximos orçamentos.";
}
