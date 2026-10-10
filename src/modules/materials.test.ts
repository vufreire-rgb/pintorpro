import { describe, expect, it } from "vitest";
import { materialsForShopping, materialsMessage } from "./materials";

describe("lista de materiais para a loja", () => {
  const q = {
    materialsText: "2 latas de tinta\n1 massa corrida",
    result: { materialLines: [{ materialId: "m1", name: "Tinta acrílica", unit: "lata 18 L", neededQty: 2.2, purchaseQty: 3, unitPriceCents: 0, costCents: 0, included: true, yieldUsed: 1 }, { materialId: "m2", name: "Fita crepe", unit: "rolo", neededQty: 1, purchaseQty: 2, unitPriceCents: 0, costCents: 0, included: false, yieldUsed: 1 }] },
  } as never;
  it("junta o que foi anotado e as quantidades calculadas (só os que o pintor compra)", () => {
    const m = materialsForShopping(q);
    expect(m.written).toEqual(["2 latas de tinta", "1 massa corrida"]);
    expect(m.calculated).toEqual(["Tinta acrílica: 3 lata 18 L"]);
  });
  it("mensagem com a obra, o endereço e os itens", () => {
    const m = materialsForShopping(q);
    const msg = materialsMessage({ company: "Silva Pinturas", clientName: "Ana Lima", address: "Rua A, 10", ...m });
    expect(msg).toContain("Lista de materiais — obra de Ana Lima (Silva Pinturas)");
    expect(msg).toContain("Endereço: Rua A, 10");
    expect(msg).toContain("• 2 latas de tinta");
    expect(msg).toContain("Quantidades calculadas:");
  });
  it("sem itens não gera mensagem", () => {
    expect(materialsMessage({ company: "X", clientName: "", address: "", written: [], calculated: [] })).toBe("");
  });
});
