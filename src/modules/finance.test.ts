import { describe, expect, it } from "vitest";
import { buildPlan, chargeMessage, lateCents, planGapCents, planView, valorPorExtenso } from "./finance";
import { crc16, guessPixType, normalizePixKey, pixKeyPreview, pixPayload, pixText } from "./pix";
import type { Work } from "./types";

const w = (o: Partial<Work> = {}): Work => ({ id: "w", quoteId: "q", clientId: "c", title: "t", status: "scheduled", createdAt: "", plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 0, ...o });

describe("Pix copia e cola", () => {
  it("CRC16-CCITT bate com o valor de referência", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("normaliza cada tipo de chave e recusa inválidas", () => {
    expect(normalizePixKey("doc", "123.456.789-09")).toBe("12345678909");
    expect(normalizePixKey("doc", "12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizePixKey("doc", "123")).toBe("");
    expect(normalizePixKey("phone", "(11) 98888-7777")).toBe("+5511988887777");
    expect(normalizePixKey("phone", "+55 11 98888-7777")).toBe("+5511988887777");
    expect(normalizePixKey("email", " Ana@Exemplo.com ")).toBe("ana@exemplo.com");
    expect(normalizePixKey("email", "ana")).toBe("");
    expect(normalizePixKey("random", "123E4567-E89B-12D3-A456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizePixKey("random", "abc")).toBe("");
  });
  it("tira acento e limita o tamanho", () => {
    expect(pixText("Silva Pinturas & Cia. São João", 25)).toBe("SILVA PINTURAS CIA SAO JO");
  });
  it("monta o código completo, com valor e CRC correto", () => {
    const code = pixPayload({ type: "doc", key: "123.456.789-09" }, { name: "Silva Pinturas", city: "Campinas" }, 150050);
    expect(code.startsWith("000201010211")).toBe(true);
    expect(code).toContain("0014br.gov.bcb.pix011112345678909");
    expect(code).toContain("54071500.50");
    expect(code).toContain("5802BR5914SILVA PINTURAS6008CAMPINAS");
    expect(code).toContain("62070503***6304");
    const body = code.slice(0, -4);
    expect(code.slice(-4)).toBe(crc16(body));
  });
  it("sem valor não inclui o campo 54; chave inválida devolve vazio", () => {
    const code = pixPayload({ type: "email", key: "a@b.co" }, { name: "X", city: "" });
    expect(code).not.toContain("5407");
    expect(code).toContain("6006BRASIL"); // sem cidade: usa BRASIL
    expect(pixPayload({ type: "doc", key: "1" }, { name: "X", city: "Y" })).toBe("");
  });
});

describe("plano de pagamento", () => {
  it("à vista e entrada + saldo", () => {
    const a = buildPlan("avista", 300000, 50, "2026-10-10");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ label: "Pagamento único", dueDate: "2026-10-10", amountCents: 300000 });
    const b = buildPlan("entrada_final", 300000, 50, "2026-10-10", "2026-10-13");
    expect(b.map((p) => [p.label, p.dueDate, p.amountCents])).toEqual([["Entrada", "2026-10-10", 150000], ["Saldo", "2026-10-13", 150000]]);
  });
  it("parcelas: o resto da divisão vai na última e a soma fecha com o total", () => {
    const p = buildPlan("entrada_3", 100001, 40, "2026-10-10");
    expect(p).toHaveLength(4);
    expect(p.reduce((s, x) => s + x.amountCents, 0)).toBe(100001);
    expect(p[1]!.dueDate).toBe("2026-10-25");
    expect(p[3]!.dueDate).toBe("2026-11-24");
  });
  it("entrada de 100% vira pagamento único", () => {
    expect(buildPlan("entrada_final", 100000, 100, "2026-10-10")).toHaveLength(1);
  });
  it("pagamentos cobrem as parcelas em ordem e definem o estado", () => {
    const plan = [
      { id: "1", label: "Entrada", dueDate: "2026-10-01", amountCents: 100000 },
      { id: "2", label: "Parcela 1", dueDate: "2026-10-12", amountCents: 100000 },
      { id: "3", label: "Parcela 2", dueDate: "2026-10-30", amountCents: 100000 },
    ];
    const obra = w({ plan, payments: [{ id: "p", date: "2026-10-01", amountCents: 150000, note: "" }] });
    const v = planView(obra, "2026-10-10");
    expect(v.map((x) => x.state)).toEqual(["paid", "partial", "open"]);
    expect(v[1]!.coveredCents).toBe(50000);
    const late = planView(obra, "2026-10-20");
    expect(late.map((x) => x.state)).toEqual(["paid", "late", "open"]);
    expect(lateCents(obra, "2026-10-20")).toBe(50000);
    expect(lateCents(obra, "2026-10-05")).toBe(0);
    expect(planGapCents(obra)).toBe(0);
    expect(planGapCents(w({ plan: plan.slice(0, 2) }))).toBe(100000);
  });
  it("mensagem de cobrança", () => {
    const [p] = planView(w({ plan: [{ id: "1", label: "Parcela 1", dueDate: "2026-10-12", amountCents: 50000 }] }), "2026-10-10");
    const m = chargeMessage(p!, "Maria Souza", "Silva Pinturas", "CODIGOPIX", "2026-10-10");
    expect(m).toContain("Olá, Maria!");
    expect(m).toContain("(parcela 1)");
    expect(m).toContain("vence em 12/10");
    expect(m).toContain("CODIGOPIX");
    expect(m).toContain("— Silva Pinturas");
    expect(chargeMessage({ ...p!, dueDate: "2026-10-08" }, "Maria", "", undefined, "2026-10-10")).toContain("venceu em 08/10");
  });
});

describe("valor por extenso", () => {
  it.each([
    [100, "um real"],
    [150, "um real e cinquenta centavos"],
    [1, "um centavo"],
    [0, "zero real"],
    [250000, "dois mil e quinhentos reais"],
    [150050, "mil e quinhentos reais e cinquenta centavos"],
    [10000, "cem reais"],
    [12345, "cento e vinte e três reais e quarenta e cinco centavos"],
    [100000, "mil reais"],
    [200000, "dois mil reais"],
    [1000000, "dez mil reais"],
    [10100000, "cento e um mil reais"],
    [4880000, "quarenta e oito mil e oitocentos reais"],
    [123456789, "um milhão, duzentos e trinta e quatro mil, quinhentos e sessenta e sete reais e oitenta e nove centavos"],
  ])("%i -> %s", (c, text) => expect(valorPorExtenso(c)).toBe(text));
});

describe("tipo da chave Pix reconhecido sozinho", () => {
  it("reconhece e-mail, chave aleatória, CNPJ, CPF formatado e celular", () => {
    expect(guessPixType("silva@exemplo.com")).toBe("email");
    expect(guessPixType("123e4567-e89b-12d3-a456-426614174000")).toBe("random");
    expect(guessPixType("12.345.678/0001-95")).toBe("doc");
    expect(guessPixType("12345678000195")).toBe("doc");
    expect(guessPixType("123.456.789-09")).toBe("doc");
    expect(guessPixType("(11) 99999-1111")).toBe("phone");
    expect(guessPixType("+55 11 99999-1111")).toBe("phone");
    expect(guessPixType("1133334444")).toBe("phone");
    expect(guessPixType("5511999991111")).toBe("phone");
  });
  it("11 números soltos: pergunta, não adivinha (CPF ou celular)", () => {
    expect(guessPixType("11999991111")).toBe("ask");
    expect(guessPixType("11 99999-1111")).toBe("ask");
    expect(guessPixType("12345678909")).toBe("ask");
  });
  it("vazio ou incompleto: ainda não sabe", () => {
    expect(guessPixType("")).toBeNull();
    expect(guessPixType("123")).toBeNull();
    expect(guessPixType("abc")).toBeNull();
  });
});

describe("pixKeyPreview", () => {
  it("mostra a chave como o banco mostra", () => {
    expect(pixKeyPreview("doc", "12345678909")).toBe("123.456.789-09");
    expect(pixKeyPreview("doc", "12345678000190")).toBe("12.345.678/0001-90");
    expect(pixKeyPreview("phone", "11988887777")).toBe("+55 (11) 98888-7777");
    expect(pixKeyPreview("phone", "(11) 3888-7777")).toBe("+55 (11) 3888-7777");
    expect(pixKeyPreview("email", " A@B.com ")).toBe("a@b.com");
    expect(pixKeyPreview("phone", "123")).toBe("");
  });
});
