import type { PaintType, QuantityBasis, Room, RoomMeasures, ServiceConfig } from "./types";

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export const PAINT_TYPES: PaintType[] = ["acrilica", "esmalte", "piso", "grafiato", "cimento_queimado"];
const emptyByPaint = (): NonNullable<RoomMeasures["byPaint"]> =>
  Object.fromEntries(PAINT_TYPES.map((p) => [p, { walls: 0, ceiling: 0, floor: 0 }])) as NonNullable<RoomMeasures["byPaint"]>;

/**
 * Sem superfícies: paredes = perímetro × altura; teto e piso = comprimento × largura.
 * Com superfícies (medidas parede a parede): somam-se as áreas de cada uma.
 * Vãos podem ser descontados das paredes (repartidos entre os tipos de pintura em proporção).
 */
export function measureRoom(room: Room): RoomMeasures {
  const bySurface = !!room.surfaces?.length;
  const surfaces = room.surfaces ?? [];
  const walls = surfaces.filter((s) => s.kind === "wall");
  const perimeter = bySurface ? walls.reduce((a, s) => a + s.widthM, 0) : 2 * (room.lengthM + room.widthM);
  const wallsGross = bySurface ? walls.reduce((a, s) => a + s.widthM * s.heightM, 0) : perimeter * room.heightM;
  let deducted = 0;
  let doorWidths = 0;
  let doors = 0;
  let windows = 0;
  let openingPerimeter = 0;
  for (const o of room.openings) {
    if (o.deductFromArea) deducted += o.widthM * o.heightM * o.qty;
    if (o.protectPerimeter) openingPerimeter += 2 * (o.widthM + o.heightM) * o.qty;
    if (o.kind === "door") {
      doors += o.qty;
      doorWidths += o.widthM * o.qty;
    } else windows += o.qty;
  }
  const wallsNet = Math.max(0, wallsGross - deducted);
  const area = (s: { widthM: number; heightM: number }) => s.widthM * s.heightM;
  const measures: RoomMeasures = {
    roomId: room.id,
    wallsGrossM2: r4(wallsGross),
    wallsNetM2: r4(wallsNet),
    ceilingM2: r4(bySurface ? surfaces.filter((s) => s.kind === "ceiling").reduce((a, s) => a + area(s), 0) : room.lengthM * room.widthM),
    floorM2: r4(bySurface ? surfaces.filter((s) => s.kind === "floor").reduce((a, s) => a + area(s), 0) : room.lengthM * room.widthM),
    baseboardM: r4(Math.max(0, perimeter - doorWidths)),
    doorCount: doors,
    windowCount: windows,
    openingPerimeterM: r4(openingPerimeter),
  };
  if (bySurface) {
    const by = emptyByPaint();
    const keep = wallsGross > 0 ? wallsNet / wallsGross : 0;
    for (const s of surfaces) {
      if (s.kind === "wall") by[s.paint].walls += area(s) * keep;
      else if (s.kind === "ceiling") by[s.paint].ceiling += area(s);
      else by[s.paint].floor += area(s);
    }
    for (const p of PAINT_TYPES) by[p] = { walls: r4(by[p].walls), ceiling: r4(by[p].ceiling), floor: r4(by[p].floor) };
    measures.byPaint = by;
  }
  return measures;
}

/** Registro de bases de quantidade. Para um novo tipo de cálculo, adicione uma entrada aqui. */
const bases: Record<QuantityBasis, (m: RoomMeasures) => number> = {
  walls_area: (m) => m.wallsNetM2,
  ceiling_area: (m) => m.ceilingM2,
  floor_area: (m) => m.floorM2,
  paint_area: () => 0, // só faz sentido com `paint` e superfícies medidas; ver quantityForBasis
  baseboard_length: (m) => m.baseboardM,
  door_count: (m) => m.doorCount,
  window_count: (m) => m.windowCount,
  opening_perimeter: (m) => m.openingPerimeterM,
  room_count: () => 1,
  fixed: () => 1,
};

/**
 * Quantidade de um serviço. Em ambiente medido por superfície, um serviço com `paint` conta só as
 * superfícies daquele tipo de pintura (paredes, teto ou piso, conforme a base; `paint_area` soma tudo).
 */
export function quantityForBasis(basis: QuantityBasis, m: RoomMeasures, svc?: Pick<ServiceConfig, "paint">): number {
  if (m.byPaint && svc?.paint) {
    const a = m.byPaint[svc.paint];
    if (basis === "walls_area") return a.walls;
    if (basis === "ceiling_area") return a.ceiling;
    if (basis === "floor_area") return a.floor;
    if (basis === "paint_area") return r4(a.walls + a.ceiling + a.floor);
  }
  return bases[basis](m);
}
