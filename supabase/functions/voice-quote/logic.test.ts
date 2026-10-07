import { describe, expect, it } from "vitest";
import { normalizeDraft } from "./logic";

describe("normalizeDraft", () => {
  it("devolve rascunho vazio para lixo", () => {
    expect(normalizeDraft("não é json")).toMatchObject({ clientName: "", rooms: [], closedPriceReais: 0 });
    expect(normalizeDraft(null).rooms).toEqual([]);
  });
  it("limpa tipos, limites e valores fora da lista", () => {
    const d = normalizeDraft(JSON.stringify({
      clientName: "  Dona Maria ", closedPriceReais: "2800,50", rooms: [{ name: "Sala", lengthM: "4,5", widthM: -3, heightM: 999, paint: "dourada", condition: "x", doors: 2.4, includeCeiling: "sim" }],
    }));
    expect(d.clientName).toBe("Dona Maria");
    expect(d.closedPriceReais).toBe(2800.5);
    expect(d.rooms[0]).toMatchObject({ name: "Sala", lengthM: 4.5, widthM: 0, heightM: 10, paint: "acrilica", condition: "pintada", doors: 2, includeCeiling: false });
  });
  it("limita a 20 ambientes", () => {
    expect(normalizeDraft({ rooms: Array.from({ length: 50 }, () => ({})) }).rooms).toHaveLength(20);
  });
});
