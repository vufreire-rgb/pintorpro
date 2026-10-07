import { describe, expect, it } from "vitest";
import { cleanDate, normalizeReceipt } from "./logic";

const today = new Date("2026-10-07T12:00:00");
describe("normalizeReceipt", () => {
  it("lixo vira rascunho vazio", () => {
    expect(normalizeReceipt("não é json", today)).toMatchObject({ amountReais: 0, date: "", store: "", kind: "material" });
  });
  it("limpa valor, data e tipo", () => {
    const d = normalizeReceipt({ amountReais: "1.234,50", date: "2026-10-01", store: " Loja Tintas ", kind: "combustivel", description: "2 latas" }, today);
    expect(d).toEqual({ amountReais: 1234.5, date: "2026-10-01", store: "Loja Tintas", kind: "material", description: "2 latas" });
  });
  it("valor negativo ou absurdo é limitado", () => {
    expect(normalizeReceipt({ amountReais: -5 }, today).amountReais).toBe(0);
    expect(normalizeReceipt({ amountReais: 99999999 }, today).amountReais).toBe(1_000_000);
  });
});
describe("cleanDate", () => {
  it("aceita datas recentes e recusa futuras, antigas e inválidas", () => {
    expect(cleanDate("2026-10-07", today)).toBe("2026-10-07");
    expect(cleanDate("2026-12-25", today)).toBe("");
    expect(cleanDate("2020-01-01", today)).toBe("");
    expect(cleanDate("2026-02-31", today)).toBe("");
    expect(cleanDate("07/10/2026", today)).toBe("");
  });
});
