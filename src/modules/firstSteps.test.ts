import { describe, expect, it } from "vitest";
import { firstSteps } from "./firstSteps";
import type { Db } from "./types";

const base = (over: Partial<Db> = {}): Db => ({ company: { name: "x" }, visits: [], quotes: [], works: [], clients: [], ...over }) as unknown as Db;
const done = (db: Db) => firstSteps(db).filter((s) => s.done).map((s) => s.id);

describe("firstSteps", () => {
  it("conta nova: nada feito", () => expect(done(base())).toEqual([]));
  it("visita, orçamento e obra de exemplo não contam", () => {
    const db = base({
      visits: [{ id: "v", isExample: true }] as never,
      quotes: [{ id: "q", status: "won" }] as never,
      works: [{ id: "w", quoteId: "q", isExample: true, payments: [{ amountCents: 1 }] }] as never,
    });
    expect(done(db)).toEqual([]);
  });
  it("uso de verdade conclui os passos", () => {
    const db = base({
      company: { name: "x", logoId: "l", pix: { key: "k" } } as never,
      visits: [{ id: "v" }] as never,
      quotes: [{ id: "q", status: "won" }] as never,
      works: [{ id: "w", quoteId: "q", payments: [{ amountCents: 1 }] }] as never,
    });
    expect(done(db)).toEqual(["logo", "pix", "visita", "orcamento", "fechar", "receber"]);
  });
});
