import type { QuantityBasis, Room, RoomMeasures } from "./types";

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Paredes = perímetro × altura; teto = comprimento × largura; vãos podem ser descontados. */
export function measureRoom(room: Room): RoomMeasures {
  const perimeter = 2 * (room.lengthM + room.widthM);
  const wallsGross = perimeter * room.heightM;
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
  return {
    roomId: room.id,
    wallsGrossM2: r4(wallsGross),
    wallsNetM2: r4(Math.max(0, wallsGross - deducted)),
    ceilingM2: r4(room.lengthM * room.widthM),
    baseboardM: r4(Math.max(0, perimeter - doorWidths)),
    doorCount: doors,
    windowCount: windows,
    openingPerimeterM: r4(openingPerimeter),
  };
}

/** Registro de bases de quantidade. Para um novo tipo de cálculo, adicione uma entrada aqui. */
const bases: Record<QuantityBasis, (m: RoomMeasures) => number> = {
  walls_area: (m) => m.wallsNetM2,
  ceiling_area: (m) => m.ceilingM2,
  baseboard_length: (m) => m.baseboardM,
  door_count: (m) => m.doorCount,
  window_count: (m) => m.windowCount,
  opening_perimeter: (m) => m.openingPerimeterM,
  room_count: () => 1,
  fixed: () => 1,
};

export const quantityForBasis = (basis: QuantityBasis, m: RoomMeasures): number => bases[basis](m);
