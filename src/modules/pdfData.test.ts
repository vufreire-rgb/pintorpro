import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn() }));

import { calculateQuote } from "@/engine";
import { DEFAULT_MATERIALS, DEFAULT_SERVICES, PDF_COLORS } from "./catalog";
import { allocate, buildPdfData, initialsOf, padNumber, tintOf } from "./pdfData";
import type { Db, EngineConfig, Quote, QuoteInput } from "./types";

const config: EngineConfig = {
  services: DEFAULT_SERVICES,
  materials: DEFAULT_MATERIALS,
  crew: { workers: 1, hourlyCostCents: 3125 },
  hoursPerDay: 8,
  safetyDays: 1,
  pricingMode: "base_price",
  marginMode: "on_price",
  marginPct: 30,
};

const input: QuoteInput = {
  extras: [],
  rooms: [
    { id: "r1", name: "Sala", lengthM: 5, widthM: 4, heightM: 2.5, openings: [{ kind: "window", widthM: 1.2, heightM: 1, qty: 1, deductFromArea: true, protectPerimeter: true }], services: [{ serviceId: "pintura_parede" }, { serviceId: "massa_corrida" }, { serviceId: "pintura_teto" }] },
    { id: "r2", name: "Quarto", lengthM: 4, widthM: 3, heightM: 2.5, openings: [{ kind: "door", widthM: 0.8, heightM: 2.1, qty: 1, deductFromArea: true, protectPerimeter: false }], services: [{ serviceId: "pintura_parede", coats: 3 }, { serviceId: "portas" }] },
  ],
};

function make(over: Partial<Quote> = {}, company: Partial<NonNullable<Db["company"]>> = {}): { db: Db; q: Quote } {
  const result = calculateQuote(input, config);
  const q: Quote = {
    id: "q1", number: 42, clientId: "c1", siteAddress: "Rua das Flores, 120, ap. 32", status: "open",
    createdAt: "2026-10-02T12:00:00Z", validUntil: "2026-10-09T12:00:00Z", paymentTerms: "50% na entrada e 50% na entrega",
    notes: "", input, configSnapshot: config, engineVersion: "t", result, ...over,
  };
  const db = {
    company: { name: "Silva Pinturas", whatsapp: "(11) 90000-0000", city: "São Paulo, SP", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price", ...company },
    clients: [{ id: "c1", name: "Maria Souza", phone: "", address: "" }],
  } as unknown as Db;
  return { db, q };
}

describe("pdfData", () => {
  it("tom claro (8% + branco) bate com a ficha do designer para as 6 cores", () => {
    const esperado: Record<string, string> = { "#0F3B7A": "#ECEFF4", "#0B7F44": "#EBF5F0", "#B3261E": "#F9EEED", "#A24A00": "#F8F1EB", "#6B3FA0": "#F3F0F7", "#2B3440": "#EEEFF0" };
    for (const c of PDF_COLORS) expect(tintOf(c.hex)).toBe(esperado[c.hex]);
  });

  it("iniciais e número", () => {
    expect(initialsOf("Silva Pinturas")).toBe("SP");
    expect(initialsOf("joão")).toBe("JO");
    expect(initialsOf("  ")).toBe("•");
    expect(padNumber(42)).toBe("0042");
  });

  it("allocate fecha exatamente o total", () => {
    expect(allocate(485000, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(485000);
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
  });

  it("monta resumo, fatos do ambiente, serviços em linguagem de cliente e materiais", () => {
    const { db, q } = make();
    const d = buildPdfData(db, q);
    expect(d.number).toBe("0042");
    expect(d.summary).toMatch(/^Pintura de 2 ambientes, sala e quarto: .* de paredes e .* de teto, com preparação, tinta e mão de obra\.$/);
    const sala = d.rooms[0]!;
    expect(sala.facts).toMatch(/de parede · .* de teto · 1 janela/);
    expect(sala.items).toEqual(["Aplicar massa corrida nas paredes", "Pintar as paredes, 2 demãos", "Pintar o teto, 2 demãos"]); // na ordem do preparo à pintura
    expect(sala.materials).toBe("Massa corrida e tinta acrílica.");
    expect(d.rooms[1]!.items).toContain("Pintar as paredes, 3 demãos");
    expect(d.days).toMatch(/dias úteis/);
  });

  it("nunca vaza custo, lucro ou margem", () => {
    const { db, q } = make();
    const json = JSON.stringify(buildPdfData(db, q)).toLowerCase();
    for (const word of ["custo", "lucro", "margem", "costcents", "profit"]) expect(json).not.toContain(word);
  });

  it("valor por ambiente só aparece se ligado, e soma o total", () => {
    const { db, q } = make();
    expect(buildPdfData(db, q).rooms.every((r) => r.price === undefined)).toBe(true);
    const on = buildPdfData(db, { ...q, showRoomPrices: true });
    const sum = on.rooms.reduce((a, r) => a + Number(r.price!.replace(/[^\d,]/g, "").replace(",", ".")) * 100, 0);
    expect(Math.round(sum)).toBe(q.result.totals.totalCents);
  });

  it("bloco de pagar a entrada só com link; valor = % do total", () => {
    const { db, q } = make();
    expect(buildPdfData(db, q).deposit).toBeNull();
    const d = buildPdfData(db, { ...q, paymentLink: " https://pague.exemplo.com.br/0042 ", depositPct: 30 });
    expect(d.deposit?.link).toBe("https://pague.exemplo.com.br/0042");
    expect(d.deposit?.pct).toBe("30% do valor total.");
    expect(d.deposit?.amount.replace(/\s/g, " ")).toContain(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.round(q.result.totals.totalCents * 0.3) / 100).replace(/\s/g, " "),
    );
  });

  it("usa a cor e os textos do pintor; contas antigas usam os padrões", () => {
    const { db, q } = make({}, { brandColor: "#0B7F44", ownerName: "Carlos Silva", exclusionsText: "Pintar tetos altos\n\nPintar grades" });
    const d = buildPdfData(db, q);
    expect(d.color).toBe("#0B7F44");
    expect(d.painter.contact).toBe("Carlos Silva · São Paulo, SP");
    expect(d.terms.exclusions).toEqual(["Pintar tetos altos", "Pintar grades"]);
    expect(d.terms.warranty).toMatch(/12 meses/);
    expect(buildPdfData(make().db, q).color).toBe("#0F3B7A");
  });

  it("limita a 6 fotos", () => {
    const { db, q } = make();
    const photos = Array.from({ length: 9 }, (_, i) => ({ src: "x" + i, room: "", caption: "" }));
    expect(buildPdfData(db, q, photos).photos).toHaveLength(6);
  });

  it("orçamento só com preço: o que será feito vira o resumo e não há ambientes", () => {
    const priceOnly: QuoteInput = { rooms: [], extras: [{ description: "Pintura completa do apartamento, tinta inclusa", priceCents: 250000, costCents: 0 }] };
    const { db, q } = make({ input: priceOnly, result: calculateQuote(priceOnly, config) });
    const d = buildPdfData(db, q);
    expect(d.summary).toBe("Pintura completa do apartamento, tinta inclusa.");
    expect(d.rooms).toHaveLength(0);
    expect(d.days).toBe("A combinar");
  });
});

describe("orçamento só com preço, por ambientes", () => {
  const priceInput: QuoteInput = { rooms: [], extras: [{ description: "Sala", priceCents: 120000, costCents: 0 }, { description: "Quarto", priceCents: 150000, costCents: 0 }, { description: "Cozinha", priceCents: 80000, costCents: 0 }] };
  it("cada ambiente vira um bloco com o seu valor e a soma fecha o total", () => {
    const { db, q } = make({ input: priceInput, result: calculateQuote(priceInput, config) });
    const d = buildPdfData(db, q);
    expect(d.rooms.map((r) => r.name)).toEqual(["Sala", "Quarto", "Cozinha"]);
    expect(d.rooms.map((r) => r.priceCents)).toEqual([120000, 150000, 80000]);
    expect(d.rooms.reduce((a, r) => a + (r.priceCents ?? 0), 0)).toBe(q.result.totals.totalCents);
    expect(d.summary).toMatch(/3 ambientes: sala, quarto e cozinha/);
  });
  it("um item só continua sem ambientes (resumo em texto)", () => {
    const one: QuoteInput = { rooms: [], extras: [{ description: "Pintura completa", priceCents: 280000, costCents: 0 }] };
    const { db, q } = make({ input: one, result: calculateQuote(one, config) });
    const d = buildPdfData(db, q);
    expect(d.rooms).toEqual([]);
    expect(d.summary).toBe("Pintura completa.");
  });
});
