import { describe, expect, it, vi } from "vitest";
vi.mock("@/repositories/cloudStore", () => ({ acceptQuoteLink: vi.fn() }));
import { closeChoice, closeMessage, selectedCents } from "./quoteAccept";

const q = {
  number: "0007",
  painter: { company: "Silva Pinturas", initials: "SP", contact: "", whatsapp: "" },
  total: "R$ 3.500,00",
  rooms: [
    { name: "Sala", facts: "", items: [], materials: "", price: "R$ 1.200,00", priceCents: 120000 },
    { name: "Quarto", facts: "", items: [], materials: "", price: "R$ 1.500,00", priceCents: 150000 },
    { name: "Cozinha", facts: "", items: [], materials: "", price: "R$ 800,00", priceCents: 80000 },
  ],
};

describe("fechar agora (cliente)", () => {
  it("todos os ambientes: total cheio do orçamento", () => {
    const c = closeChoice(q, new Set([0, 1, 2]));
    expect(c).toMatchObject({ all: true, totalLabel: "R$ 3.500,00" });
    expect(closeMessage(q, c)).toContain("Ambientes: todos.");
    expect(closeMessage(q, c)).toContain("Total: R$ 3.500,00.");
  });
  it("alguns ambientes: soma só os escolhidos", () => {
    const c = closeChoice(q, new Set([2, 0]));
    expect(c.names).toEqual(["Sala", "Cozinha"]);
    expect(c.totalLabel).toMatch(/R\$\s2\.000,00/);
    expect(closeMessage(q, c)).toMatch(/Ambientes escolhidos \(2 de 3\): Sala, Cozinha\./);
  });
  it("sem valor por ambiente não inventa total parcial", () => {
    expect(selectedCents([{ name: "A", facts: "", items: [], materials: "", price: "" }], new Set([0]))).toBeNull();
  });
  it("orçamento sem ambientes é o inteiro", () => {
    const c = closeChoice({ rooms: [], total: "R$ 2.800,00" }, new Set());
    expect(c.all).toBe(true);
    expect(closeMessage({ ...q, rooms: [] }, c)).not.toContain("Ambientes");
  });
});
