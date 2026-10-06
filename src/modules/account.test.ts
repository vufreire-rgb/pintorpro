import { describe, expect, it } from "vitest";
import { confirmsDeletion } from "./account";

describe("confirmsDeletion", () => {
  it("aceita a palavra EXCLUIR em qualquer caixa e com espaços nas pontas", () => {
    expect(confirmsDeletion("EXCLUIR")).toBe(true);
    expect(confirmsDeletion("  excluir ")).toBe(true);
  });
  it("não aceita outra coisa", () => {
    expect(confirmsDeletion("")).toBe(false);
    expect(confirmsDeletion("excluir conta")).toBe(false);
    expect(confirmsDeletion("apagar")).toBe(false);
  });
});
