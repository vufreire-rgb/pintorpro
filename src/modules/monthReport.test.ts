import { describe, expect, it } from "vitest";
import { monthLabel, monthReport, shiftMonth } from "./monthReport";
import type { Db, Quote, Work } from "./types";

const quote = (id: string, total: number, closedAt: string, status: Quote["status"] = "won"): Quote => ({ id, status, closedAt, input: { rooms: id === "q2" ? [] : [{}], extras: [] }, result: { totals: { totalCents: total, profitCents: Math.round(total / 4), costCents: 0, laborCostCents: 0 } } } as unknown as Quote);
const work = (id: string, quoteId: string, total: number, extra: Partial<Work> = {}): Work => ({ id, quoteId, clientId: "c", title: "", status: "in_progress", createdAt: "", plannedDays: 1, plannedHours: 8, plannedTotalCents: total, plannedCostCents: 0, ...extra });

const db = {
  quotes: [quote("q1", 100000, "2026-10-05T12:00:00"), quote("q2", 50000, "2026-09-20T12:00:00"), quote("q3", 70000, "2026-10-08T12:00:00", "open"), quote("qx", 9999, "2026-10-02T12:00:00")],
  works: [
    work("w1", "q1", 100000, { payments: [{ id: "p1", date: "2026-10-06", amountCents: 40000, note: "" }, { id: "p2", date: "2026-09-30", amountCents: 10000, note: "" }], expenses: [{ id: "e1", date: "2026-10-07", kind: "material", amountCents: 15000, note: "" }] }),
    work("w2", "q2", 50000),
    work("wx", "qx", 9999, { isExample: true, payments: [{ id: "px", date: "2026-10-06", amountCents: 9999, note: "" }] }),
  ],
} as unknown as Db;

describe("monthReport", () => {
  it("soma só o mês pedido e ignora obras de exemplo e orçamentos abertos", () => {
    const r = monthReport(db, "2026-10");
    expect(r.soldCents).toBe(100000);
    expect(r.soldCount).toBe(1);
    expect(r.receivedCents).toBe(40000);
    expect(r.spentCents).toBe(15000);
    expect(r.netCents).toBe(25000);
  });
  it("a receber é o que falta hoje em todas as obras", () => {
    expect(monthReport(db, "2026-10").toReceiveCents).toBe(100000 - 50000 + 50000);
    expect(monthReport(db, "2026-08").toReceiveCents).toBe(100000);
  });
  it("lucro estimado conta só orçamentos com medidas; trabalhos e atraso vêm das obras", () => {
    const r = monthReport(db, "2026-10");
    expect(r.estimatedProfitCents).toBe(25000);
    expect(r.activeWorks).toBe(2);
    expect(r.lateCents).toBe(0);
    expect(r.trackedWorks).toBe(0); // w1 foi criada em "" (fora do mês) neste cenário
  });
  it("mês vazio dá zero", () => {
    expect(monthReport(db, "2026-08")).toMatchObject({ soldCents: 0, receivedCents: 0, spentCents: 0, netCents: 0 });
  });
  it("navega entre meses e vira o ano", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-10")).toBe("outubro de 2026");
  });
});
