import { describe, expect, it, vi } from "vitest";
vi.mock("@/repositories/cloudStore", () => ({ sendDictation: vi.fn() }));
import { appendDictation, dictationFailureText } from "./dictation";

describe("ditado", () => {
  it("texto novo começa com letra maiúscula", () => {
    expect(appendDictation("", "parede com mofo")).toBe("Parede com mofo");
  });
  it("junta ao que já estava, sem apagar", () => {
    expect(appendDictation("Cliente quer branco gelo", "parede com mofo na janela")).toBe("Cliente quer branco gelo. Parede com mofo na janela");
    expect(appendDictation("Cliente quer branco gelo.  ", "tem cachorro")).toBe("Cliente quer branco gelo. Tem cachorro");
  });
  it("não muda nada se não entendeu nada", () => {
    expect(appendDictation("abc", "   ")).toBe("abc");
  });
  it("mensagens de erro em português claro", () => {
    expect(dictationFailureText("daily_limit")).toMatch(/limite de ditados/);
    expect(dictationFailureText("network")).toMatch(/Sem internet/);
    expect(dictationFailureText("qualquer")).toMatch(/Não consegui entender/);
  });
});
