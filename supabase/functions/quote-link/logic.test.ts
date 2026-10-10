import { describe, expect, it } from "vitest";
import { isToken, peekSnapshot, newToken, sanitizeSnapshot, shouldCountView, shouldNotifyView, SIX_HOURS_MS, VIEW_WINDOW_MS } from "./logic";

const ok = { painter: { company: "Silva Pinturas", initials: "SP", contact: "", whatsapp: "11999990000" }, number: "0042", total: "R$ 2.800,00", clientName: "Maria", rooms: [{ name: "Sala", items: ["Pintar paredes"] }], color: "#B3261E" };

describe("token", () => {
  it("é único, tem 24 caracteres e só letras, números, - e _", () => {
    const a = newToken(), b = newToken();
    expect(isToken(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isToken("curto")).toBe(false);
    expect(isToken("../../etc/passwd/........")).toBe(false);
  });
});
describe("sanitizeSnapshot", () => {
  it("aceita um orçamento completo e descarta campos desconhecidos", () => {
    const s = sanitizeSnapshot({ ...ok, segredo: "x", custo: 123 })!;
    expect(s.painter.company).toBe("Silva Pinturas");
    expect(s.rooms[0]!.items).toEqual(["Pintar paredes"]);
    expect(JSON.stringify(s)).not.toContain("segredo");
    expect(JSON.stringify(s)).not.toContain("custo");
  });
  it("recusa vazio, sem total ou grande demais", () => {
    expect(sanitizeSnapshot(null)).toBeNull();
    expect(sanitizeSnapshot({ ...ok, total: "" })).toBeNull();
    expect(sanitizeSnapshot({ ...ok, notes: "x".repeat(90_000) })).toBeNull();
  });
  it("cor inválida volta ao azul padrão e links que não são https são removidos", () => {
    expect(sanitizeSnapshot({ ...ok, color: "red" })!.color).toBe("#0F3B7A");
    expect(sanitizeSnapshot({ ...ok, deposit: { amount: "R$ 1", pct: "50%", link: "javascript:alert(1)" } })!.deposit).toBeNull();
    expect(sanitizeSnapshot({ ...ok, deposit: { amount: "R$ 1", pct: "50%", link: "https://pagar.exemplo.com/x" } })!.deposit?.link).toBe("https://pagar.exemplo.com/x");
  });
  it("limita ambientes", () => {
    expect(sanitizeSnapshot({ ...ok, rooms: Array.from({ length: 80 }, () => ({ name: "x" })) })!.rooms).toHaveLength(30);
  });
});
describe("shouldCountView", () => {
  it("conta a primeira e as que passam da janela; ignora atualizações seguidas", () => {
    const now = Date.now();
    expect(shouldCountView(null, now)).toBe(true);
    expect(shouldCountView(new Date(now - 60_000).toISOString(), now)).toBe(false);
    expect(shouldCountView(new Date(now - VIEW_WINDOW_MS - 1).toISOString(), now)).toBe(true);
  });
});

describe("shouldNotifyView", () => {
  it("avisa na primeira abertura e depois só após 6 horas", () => {
    const now = Date.now();
    expect(shouldNotifyView(0, null, now)).toBe(true);
    expect(shouldNotifyView(2, new Date(now - 3600_000).toISOString(), now)).toBe(false);
    expect(shouldNotifyView(2, new Date(now - SIX_HOURS_MS - 1).toISOString(), now)).toBe(true);
  });
});

describe("peekSnapshot", () => {
  it("devolve só o necessário para a prévia", () => {
    const p = peekSnapshot({ color: "#B3261E", number: "0007", total: "R$ 1.800,00", painter: { company: "Silva Pinturas", whatsapp: "11999990000" }, clientName: "Maria", siteAddress: "Rua A", pix: { code: "x" } })!;
    expect(p).toEqual({ color: "#B3261E", company: "Silva Pinturas", number: "0007", total: "R$ 1.800,00" });
    expect(JSON.stringify(p)).not.toMatch(/Maria|Rua A|11999990000|pix/i);
  });
  it("sem empresa não gera prévia; cor inválida volta ao azul", () => {
    expect(peekSnapshot({})).toBeNull();
    expect(peekSnapshot({ color: "azul", painter: { company: "X" } })!.color).toBe("#0F3B7A");
  });
});
