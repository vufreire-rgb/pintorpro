import { describe, expect, it } from "vitest";
import { deltaTone, whatsappDigits } from "./adminPanel";

describe("painel do administrador", () => {
  it("monta o número do WhatsApp com 55", () => {
    expect(whatsappDigits("(11) 99999-0000")).toBe("5511999990000");
    expect(whatsappDigits("+55 11 99999-0000")).toBe("5511999990000");
    expect(whatsappDigits("123")).toBe("");
  });
  it("cor da variação", () => {
    expect(deltaTone("+12%")).toBe("up");
    expect(deltaTone("−5%")).toBe("down");
    expect(deltaTone("+12%", false)).toBe("down");
    expect(deltaTone("igual")).toBe("flat");
    expect(deltaTone(null)).toBe("flat");
  });
});
