import { describe, expect, it } from "vitest";
import { formatBRL, toCents } from "./money";

describe("money", () => {
  it("converte reais em centavos sem erro de ponto flutuante", () => {
    expect(toCents(19.9)).toBe(1990);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
  it("formata em BRL", () => {
    expect(formatBRL(485000).replace(/\s/g, " ")).toBe("R$ 4.850,00");
  });
});
