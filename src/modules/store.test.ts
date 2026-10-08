import { describe, expect, it } from "vitest";
import { STORE_CATEGORIES, storeUrl } from "./store";

describe("loja", () => {
  it("monta link de busca sem espaços nem acentos quebrados", () => {
    expect(storeUrl("Rolo de lã pintura")).toBe("https://lista.mercadolivre.com.br/rolo-de-l%C3%A3-pintura");
  });
  it("todo item tem título, dica e busca", () => {
    for (const c of STORE_CATEGORIES) for (const i of c.items) {
      expect(i.title && i.hint && i.query).toBeTruthy();
      expect(storeUrl(i.query)).toMatch(/^https:\/\/lista\.mercadolivre\.com\.br\/[a-z0-9%-]+$/);
    }
  });
  it("ids são únicos", () => {
    const ids = STORE_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
