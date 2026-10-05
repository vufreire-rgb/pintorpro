import { describe, expect, it } from "vitest";
import { profitHint, workProfit } from "./workProfit";
import type { Quote, Work } from "./types";

const quote = { result: { totals: { costCents: 70000, laborCostCents: 40000 } } } as unknown as Quote;
const work = (extra: Partial<Work> = {}): Work => ({ id: "w", quoteId: "q", clientId: "c", title: "t", status: "in_progress", createdAt: "", plannedDays: 4, plannedHours: 32, plannedTotalCents: 100000, plannedCostCents: 70000, ...extra });

describe("workProfit", () => {
  it("previsto: material 300, diária 400, lucro depois da diária 300", () => {
    const p = workProfit(work(), quote);
    expect([p.plannedSpendCents, p.plannedDiariaCents, p.plannedPocketCents, p.plannedProfitCents]).toEqual([30000, 40000, 70000, 30000]);
    expect(p.realDiariaCents).toBeNull();
  });
  it("real: soma por tipo e diária por dias trabalhados", () => {
    const p = workProfit(work({ daysWorked: 5, expenses: [{ id: "1", date: "", kind: "material", amountCents: 35000, note: "" }, { id: "2", date: "", kind: "transporte", amountCents: 5000, note: "" }] }), quote);
    expect(p.spentCents).toBe(40000);
    expect(p.realPocketCents).toBe(60000);
    expect(p.realDiariaCents).toBe(50000); // 5 dias × R$100/dia
    expect(p.realProfitCents).toBe(10000);
    expect(p.deltaCents).toBe(-20000);
    expect(profitHint(p, 30000)).toMatch(/menos/);
  });
  it("sem gastos não opina; perto do previsto diz que está certo", () => {
    expect(profitHint(workProfit(work(), quote), 30000)).toBeNull();
    const p = workProfit(work({ daysWorked: 4, expenses: [{ id: "1", date: "", kind: "material", amountCents: 30000, note: "" }] }), quote);
    expect(profitHint(p, 30000)).toMatch(/certo/);
  });
});
