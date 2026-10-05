import { describe, expect, it } from "vitest";
import { calculateQuote, measureRoom } from "..";
import type { EngineConfig, Room, Surface } from "..";

const wall = (id: string, w: number, h: number, paint: Surface["paint"] = "acrilica"): Surface => ({ id, kind: "wall", label: id, widthM: w, heightM: h, paint });
const ceiling = (id: string, w: number, h: number, paint: Surface["paint"] = "acrilica"): Surface => ({ id, kind: "ceiling", label: id, widthM: w, heightM: h, paint });
const floor = (id: string, w: number, h: number, paint: Surface["paint"] = "piso"): Surface => ({ id, kind: "floor", label: id, widthM: w, heightM: h, paint });

const config: EngineConfig = {
  services: [
    { id: "parede", paint: "acrilica", name: "Pintura de paredes", unit: "m2", basis: "walls_area", salePriceCents: 2000, productivityPerHour: 10, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "teto", paint: "acrilica", name: "Pintura de teto", unit: "m2", basis: "ceiling_area", salePriceCents: 2500, productivityPerHour: 10, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "prep", name: "Lixamento", unit: "m2", basis: "walls_area", salePriceCents: 400, productivityPerHour: 15, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "esmalte", paint: "esmalte", name: "Esmalte", unit: "m2", basis: "paint_area", salePriceCents: 3000, productivityPerHour: 8, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "piso", paint: "piso", name: "Piso", unit: "m2", basis: "paint_area", salePriceCents: 2200, productivityPerHour: 10, usesCoats: false, defaultCoats: 1, materialIds: [] },
    { id: "rodape", name: "Rodapé", unit: "ml", basis: "baseboard_length", salePriceCents: 800, productivityPerHour: 15, usesCoats: false, defaultCoats: 1, materialIds: [] },
  ],
  materials: [],
  crew: { workers: 1, hourlyCostCents: 2500 },
  hoursPerDay: 8,
  safetyDays: 1,
  pricingMode: "base_price",
  marginMode: "on_price",
  marginPct: 30,
};

const room = (surfaces: Surface[], over: Partial<Room> = {}): Room => ({ id: "r", name: "Sala", lengthM: 0, widthM: 0, heightM: 0, openings: [], services: [], surfaces, ...over });

describe("medidas por parede", () => {
  it("soma as áreas de cada superfície", () => {
    const m = measureRoom(room([wall("p1", 5, 2.5), wall("p2", 4, 2.5), wall("p3", 5, 2.5), wall("p4", 4, 2.5), ceiling("t", 5, 4), floor("f", 5, 4)]));
    expect(m.wallsNetM2).toBe(45);
    expect(m.ceilingM2).toBe(20);
    expect(m.floorM2).toBe(20);
    expect(m.baseboardM).toBe(18); // soma das larguras das paredes
  });
  it("desconta os vãos e reparte entre os tipos de pintura em proporção", () => {
    const door = { kind: "door" as const, widthM: 1, heightM: 2, qty: 1, deductFromArea: true, protectPerimeter: true };
    const m = measureRoom(room([wall("p1", 4, 2.5), wall("p2", 4, 2.5, "grafiato")], { openings: [door] }));
    expect(m.wallsNetM2).toBe(18); // 20 − 2
    expect(m.byPaint!.acrilica.walls).toBe(9);
    expect(m.byPaint!.grafiato.walls).toBe(9);
    expect(m.baseboardM).toBe(7); // 8 − largura da porta
  });
  it("sem superfícies o cálculo antigo continua igual", () => {
    const m = measureRoom({ id: "r", name: "Sala", lengthM: 5, widthM: 4, heightM: 2.5, openings: [], services: [] });
    expect(m.wallsNetM2).toBe(45);
    expect(m.ceilingM2).toBe(20);
    expect(m.byPaint).toBeUndefined();
  });
});

describe("serviços por tipo de pintura", () => {
  const services = (ids: string[]) => ids.map((serviceId) => ({ serviceId }));
  const qty = (r: Room, id: string) => calculateQuote({ rooms: [r], extras: [] }, config).serviceLines.find((l) => l.serviceId === id)?.quantity;

  it("cada serviço de pintura conta só as superfícies do seu tipo; o preparo conta todas as paredes", () => {
    const r = room([wall("p1", 4, 2.5), wall("p2", 4, 2.5, "esmalte"), ceiling("t", 4, 4), floor("f", 4, 4)], { services: services(["parede", "teto", "prep", "esmalte", "piso"]) });
    expect(qty(r, "parede")).toBe(10);
    expect(qty(r, "esmalte")).toBe(10);
    expect(qty(r, "teto")).toBe(16);
    expect(qty(r, "piso")).toBe(16);
    expect(qty(r, "prep")).toBe(20);
  });
  it("rodapé usa o perímetro das paredes medidas", () => {
    const r = room([wall("p1", 4, 2.5), wall("p2", 3, 2.5)], { services: services(["rodape"]) });
    expect(qty(r, "rodape")).toBe(7);
  });
  it("avisa quando há medida de um tipo de pintura sem o serviço escolhido", () => {
    const r = room([wall("p1", 4, 2.5, "esmalte")], { services: services(["parede"]) });
    const out = calculateQuote({ rooms: [r], extras: [] }, config);
    expect(out.warnings.some((w) => w.includes("Esmalte") && w.includes("Sala"))).toBe(true);
  });
  it("superfície com largura ou altura zero não entra no preço", () => {
    const r = room([wall("p1", 0, 2.5), wall("p2", 4, 0)], { services: services(["parede"]) });
    expect(calculateQuote({ rooms: [r], extras: [] }, config).serviceLines).toHaveLength(0);
  });
});
