import { describe, expect, it } from "vitest";
import { calculateQuote, measureRoom } from "..";
import type { EngineConfig, QuoteInput, Room } from "..";

const config: EngineConfig = {
  services: [
    { id: "pintura", name: "Pintura", unit: "m2", basis: "walls_area", salePriceCents: 2000, productivityPerHour: 10, usesCoats: true, defaultCoats: 2, materialIds: ["tinta"] },
    { id: "teto", name: "Teto", unit: "m2", basis: "ceiling_area", salePriceCents: 2500, productivityPerHour: 8, usesCoats: true, defaultCoats: 2, materialIds: ["tinta"] },
    { id: "porta", name: "Porta", unit: "un", basis: "door_count", salePriceCents: 15000, productivityPerHour: null, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "protecao", name: "Proteção", unit: "ml", basis: "opening_perimeter", salePriceCents: 300, productivityPerHour: 20, usesCoats: false, defaultCoats: 1, materialIds: ["fita"] },
  ],
  materials: [
    { id: "tinta", name: "Tinta", unit: "L", priceCents: 1000, yieldPerUnit: 10, wastePct: 0 },
    { id: "fita", name: "Fita", unit: "rolo", priceCents: 800, yieldPerUnit: 50, wastePct: 0, packSize: 1 },
  ],
  crew: { workers: 1, hourlyCostCents: 2500 },
  hoursPerDay: 8,
  safetyDays: 1,
  pricingMode: "base_price",
  marginMode: "on_price",
  marginPct: 30,
};

// Sala 5 × 4 × 2,5 m: perímetro 18 m → paredes 45 m²; teto 20 m².
const room = (over: Partial<Room> = {}): Room => ({ id: "r1", name: "Sala", lengthM: 5, widthM: 4, heightM: 2.5, openings: [], services: [], ...over });
const input = (rooms: Room[], extra: Partial<QuoteInput> = {}): QuoteInput => ({ rooms, extras: [], ...extra });

describe("medições", () => {
  it("paredes = perímetro × altura; teto = comp × larg", () => {
    const m = measureRoom(room());
    expect(m.wallsNetM2).toBe(45);
    expect(m.ceilingM2).toBe(20);
  });
  it("desconta vãos da área e conta proteção de perímetro mesmo descontado", () => {
    const m = measureRoom(
      room({ openings: [{ kind: "door", widthM: 1, heightM: 2, qty: 1, deductFromArea: true, protectPerimeter: true }] }),
    );
    expect(m.wallsNetM2).toBe(43);
    expect(m.openingPerimeterM).toBe(6);
    expect(m.baseboardM).toBe(17);
  });
});

describe("materiais", () => {
  it("exemplo do documento: 100 m² × 2 demãos ÷ 10 m²/L = 20 L", () => {
    const r = calculateQuote(input([room({ lengthM: 10, widthM: 10, heightM: 2.5, services: [{ serviceId: "teto" }] })]), config);
    // teto 100 m²
    expect(r.materialLines[0]!.purchaseQty).toBe(20);
  });
  it("respeita rendimento alterado no orçamento e cliente fornecendo material", () => {
    const r = calculateQuote(
      input([room({ services: [{ serviceId: "pintura" }] })], { yieldOverrides: { tinta: 15 }, materialsIncluded: { tinta: false } }),
      config,
    );
    expect(r.materialLines[0]!.neededQty).toBe(6); // 45×2÷15
    expect(r.totals.materialsCents).toBe(0);
  });
  it("arredonda para a embalagem", () => {
    const r = calculateQuote(
      input([room({ openings: [{ kind: "door", widthM: 1, heightM: 2, qty: 1, deductFromArea: true, protectPerimeter: true }], services: [{ serviceId: "protecao" }] })]),
      config,
    );
    expect(r.materialLines[0]!.purchaseQty).toBe(1); // 6 m ÷ 50 → 1 rolo
  });
});

describe("preço e prazo", () => {
  const base = input([room({ services: [{ serviceId: "pintura" }] })]);
  it("base_price: serviços + materiais; custo = mão de obra + materiais", () => {
    const r = calculateQuote(base, config);
    // 45 m² × R$20 = 900,00 ; tinta 9 L × R$10 = 90,00
    expect(r.totals.servicesCents).toBe(90000);
    expect(r.totals.materialsCents).toBe(9000);
    expect(r.totals.totalCents).toBe(99000);
    // horas 45×2÷10 = 9 h × R$25 = 225,00
    expect(r.totals.laborCostCents).toBe(22500);
    expect(r.totals.costCents).toBe(31500);
    expect(r.totals.profitCents).toBe(67500);
    expect(r.schedule).toMatchObject({ hours: 9, workDays: 2, totalDays: 3 });
  });
  it("cost_plus com margem sobre a venda e markup diferem", () => {
    const onPrice = calculateQuote(base, { ...config, pricingMode: "cost_plus", marginMode: "on_price" });
    expect(onPrice.totals.totalCents).toBe(Math.round(31500 / 0.7));
    expect(onPrice.totals.profitMargin).toBeCloseTo(0.3, 3);
    const markup = calculateQuote(base, { ...config, pricingMode: "cost_plus", marginMode: "markup" });
    expect(markup.totals.totalCents).toBe(Math.round(31500 * 1.3));
  });
  it("aplica desconto em % e acréscimo em centavos", () => {
    const d = calculateQuote({ ...base, adjustment: { type: "discount", mode: "percent", value: 10 } }, config);
    expect(d.totals.totalCents).toBe(99000 - 9900);
    const a = calculateQuote({ ...base, adjustment: { type: "surcharge", mode: "cents", value: 5000 } }, config);
    expect(a.totals.totalCents).toBe(104000);
  });
  it("avisa quando não há produtividade e é determinístico", () => {
    const i = input([room({ openings: [{ kind: "door", widthM: 1, heightM: 2, qty: 2, deductFromArea: true, protectPerimeter: false }], services: [{ serviceId: "porta" }] })]);
    const r = calculateQuote(i, config);
    expect(r.warnings.some((w) => w.includes("sem produtividade"))).toBe(true);
    expect(r.totals.servicesCents).toBe(30000);
    expect(calculateQuote(i, config)).toEqual(r);
  });
});
