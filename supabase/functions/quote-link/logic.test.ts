import { describe, expect, it } from "vitest";
import { brl, isRepeatedAccept, isToken, peekSnapshot, pickRooms, newToken, sanitizeSnapshot, shouldCountView, shouldNotifyView, SIX_HOURS_MS, VIEW_WINDOW_MS } from "./logic";

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
    expect(sanitizeSnapshot({ ...ok, deposit: { amount: "R$ 9", pct: "50%", link: "https://p.com/x", installments: 3, installmentAmount: "R$ 3" } })!.deposit?.installments).toBe(3);
    expect(sanitizeSnapshot({ ...ok, deposit: { amount: "R$ 9", pct: "50%", link: "https://p.com/x", installments: 99, installmentAmount: "R$ 3" } })!.deposit?.installments).toBeUndefined();
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

describe("fechar agora", () => {
  const snap = { total: "R$ 3.500,00", rooms: [{ name: "Sala", priceCents: 120000 }, { name: "Quarto", priceCents: 150000 }, { name: "Cozinha", priceCents: 80000 }] };
  it("brl formata como o app", () => {
    expect(brl(350000)).toBe("R$ 3.500,00");
    expect(brl(5)).toBe("R$ 0,05");
    expect(brl(123456789)).toBe("R$ 1.234.567,89");
  });
  it("todos os ambientes: usa o total do orçamento", () => {
    expect(pickRooms(snap, [0, 1, 2])).toEqual({ names: ["Sala", "Quarto", "Cozinha"], all: true, totalCents: 350000, totalLabel: "R$ 3.500,00" });
  });
  it("só alguns: soma os valores dos ambientes escolhidos, na ordem do orçamento", () => {
    expect(pickRooms(snap, [2, 0])).toEqual({ names: ["Sala", "Cozinha"], all: false, totalCents: 200000, totalLabel: "R$ 2.000,00" });
  });
  it("recusa escolha vazia, repetida, fora da lista ou que não seja número", () => {
    for (const bad of [[], [5], [-1], [0, 0], ["0"], [1.5], "x", null, undefined, [0, 1, 2, 3]]) expect(pickRooms(snap, bad)).toBeNull();
  });
  it("sem ambientes (só preço fechado): é o orçamento inteiro", () => {
    expect(pickRooms({ rooms: [], total: "R$ 2.800,00" }, undefined)).toEqual({ names: [], all: true, totalCents: null, totalLabel: "R$ 2.800,00" });
  });
  it("sem valor por ambiente: não inventa total parcial", () => {
    expect(pickRooms({ total: "R$ 1,00", rooms: [{ name: "A" }, { name: "B" }] }, [0])!.totalLabel).toBe("");
  });
  it("dois toques seguidos contam como um só aviso", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(isRepeatedAccept("2026-10-10T11:55:00Z", now)).toBe(true);
    expect(isRepeatedAccept("2026-10-10T11:40:00Z", now)).toBe(false);
    expect(isRepeatedAccept(null, now)).toBe(false);
  });
});

describe("logo e fotos no link", () => {
  const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  it("aceita logo e fotos JPEG pequenas, com ambiente e legenda", () => {
    const o = sanitizeSnapshot({ ...ok, logo: jpg, photos: [{ src: jpg, room: "Sala", caption: "Mofo no teto" }, { src: "https://x.com/a.jpg", room: "x", caption: "y" }, { src: jpg, room: "", caption: "" }] })!;
    expect(o.logo).toBe(jpg);
    expect(o.photos).toEqual([{ src: jpg, room: "Sala", caption: "Mofo no teto" }, { src: jpg, room: "", caption: "" }]);
  });
  it("descarta o que não for JPEG em data URL e limita a 6 fotos", () => {
    const o = sanitizeSnapshot({ ...ok, logo: "javascript:alert(1)", photos: Array.from({ length: 10 }, () => ({ src: jpg, room: "", caption: "" })) })!;
    expect(o.logo).toBeUndefined();
    expect(o.photos).toHaveLength(6);
  });
  it("as imagens não entram no limite de tamanho do texto do orçamento", () => {
    const big = "data:image/jpeg;base64," + "A".repeat(200_000);
    expect(sanitizeSnapshot({ ...ok, photos: [{ src: big, room: "", caption: "" }] })?.photos).toHaveLength(1);
    expect(sanitizeSnapshot({ ...ok, notes: "x".repeat(90_000) })).toBeNull();
  });
});
