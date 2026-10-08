import { describe, expect, it } from "vitest";
import { autoWorkStatus } from "./autoStatus";
import type { Work } from "./types";

const work = (o: Partial<Work> = {}): Work => ({
  id: "w", quoteId: "q", clientId: "c", title: "t", status: "scheduled", createdAt: "2026-10-01T00:00:00Z",
  plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 0, ...o,
});
const TODAY = "2026-10-10";

describe("situação da obra decidida pelo app", () => {
  it("agendada fica agendada até chegar a data, ou até entrar pagamento/gasto", () => {
    expect(autoWorkStatus(work(), TODAY)).toBe("scheduled");
    expect(autoWorkStatus(work({ startDate: "2026-10-12" }), TODAY)).toBe("scheduled");
    expect(autoWorkStatus(work({ startDate: "2026-10-10" }), TODAY)).toBe("in_progress");
    expect(autoWorkStatus(work({ payments: [{ id: "p", date: "2026-10-02", amountCents: 100, note: "" }] }), TODAY)).toBe("in_progress");
    expect(autoWorkStatus(work({ expenses: [{ id: "e", date: "2026-10-02", kind: "material", amountCents: 100, note: "" }] }), TODAY)).toBe("in_progress");
  });

  it("conclui sozinha só quando tudo foi pago E a data de término passou", () => {
    const paid = [{ id: "p", date: "2026-10-02", amountCents: 300000, note: "" }];
    expect(autoWorkStatus(work({ status: "in_progress", payments: paid, endDate: "2026-10-09" }), TODAY)).toBe("done");
    expect(autoWorkStatus(work({ status: "in_progress", payments: paid, endDate: "2026-10-20" }), TODAY)).toBe("in_progress");
    expect(autoWorkStatus(work({ status: "in_progress", payments: paid }), TODAY)).toBe("in_progress");
    expect(autoWorkStatus(work({ status: "in_progress", payments: [{ id: "p", date: "x", amountCents: 100, note: "" }], endDate: "2026-10-09" }), TODAY)).toBe("in_progress");
  });

  it("agendada com tudo pago e término passado passa direto para concluída", () => {
    const paid = [{ id: "p", date: "2026-10-02", amountCents: 300000, note: "" }];
    expect(autoWorkStatus(work({ payments: paid, endDate: "2026-10-09" }), TODAY)).toBe("done");
  });

  it("nunca mexe em Pendências nem em obra concluída, nem conclui obra reaberta de propósito", () => {
    const paid = [{ id: "p", date: "2026-10-02", amountCents: 300000, note: "" }];
    expect(autoWorkStatus(work({ status: "issues", payments: paid, endDate: "2026-10-09" }), TODAY)).toBe("issues");
    expect(autoWorkStatus(work({ status: "done" }), TODAY)).toBe("done");
    expect(autoWorkStatus(work({ status: "in_progress", keepOpen: true, payments: paid, endDate: "2026-10-09" }), TODAY)).toBe("in_progress");
  });
});
