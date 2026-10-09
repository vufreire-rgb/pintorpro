import { measureRoom } from "@/engine";
import { CONDITION_SERVICE_IDS, PAINT_SERVICE, suggestServices } from "./catalog";
import type { Opening, PaintType, Room, Surface, VisitRoom } from "./types";

/** Dados de um ambiente como o pintor informa (tela de medidas). */
export type RoomForm = Omit<VisitRoom, "id">;

export const EMPTY_ROOM: RoomForm = { name: "", lengthM: 0, widthM: 0, heightM: 2.7, condition: "pintada", doors: 1, windows: 1 };

/** Tamanhos padrão de porta/janela: valores de partida, o pintor pode ajustar no orçamento. */
export const door = (qty: number): Opening => ({ kind: "door", widthM: 0.8, heightM: 2.1, qty, deductFromArea: true, protectPerimeter: true });
export const win = (qty: number): Opening => ({ kind: "window", widthM: 1.2, heightM: 1.0, qty, deductFromArea: true, protectPerimeter: true });

export const isRoomValid = (f: RoomForm): boolean => f.lengthM > 0 && f.widthM > 0 && f.heightM > 0;

/** Transforma as medidas do pintor em ambiente do orçamento, com os serviços sugeridos pelo estado da parede. */
export function roomFromForm(f: RoomForm, enabledServiceIds: string[], id: string = crypto.randomUUID(), fallbackName = "Ambiente"): Room {
  const openings = [...(f.doors ? [door(f.doors)] : []), ...(f.windows ? [win(f.windows)] : [])];
  const services = suggestServices(f.condition, enabledServiceIds).map((serviceId) => ({ serviceId }));
  const extra = ["pintura_teto", ...(f.doors ? ["portas"] : []), ...(f.windows ? ["janelas"] : [])].filter((s) => enabledServiceIds.includes(s));
  services.push(...extra.map((serviceId) => ({ serviceId })));
  return { id, name: f.name.trim() || fallbackName, lengthM: f.lengthM, widthM: f.widthM, heightM: f.heightM, wallCondition: f.condition, openings, services };
}

// ---------------------------------------------------------------------------------------------
// Medidas por parede: o pintor anota Parede 1, Parede 2… (largura × altura), teto e piso,
// escolhe o tipo de pintura de cada uma e o orçamento já nasce com essas medidas.
// ---------------------------------------------------------------------------------------------

/** O que o pintor edita na tela de medidas de um ambiente. */
export interface RoomDraft {
  name: string;
  surfaces: Surface[];
  doors: number;
  windows: number;
}

type Kind = Surface["kind"];
const KIND_LABEL: Record<Kind, string> = { wall: "Parede", ceiling: "Teto", floor: "Piso" };

/** Nomes automáticos: Parede 1, Parede 2… / Teto, Teto 2 / Piso, Piso 2. */
export function relabel(surfaces: Surface[]): Surface[] {
  const n: Record<Kind, number> = { wall: 0, ceiling: 0, floor: 0 };
  return surfaces.map((s) => {
    n[s.kind] += 1;
    const label = s.kind === "wall" || n[s.kind] > 1 ? `${KIND_LABEL[s.kind]} ${n[s.kind]}` : KIND_LABEL[s.kind];
    return { ...s, label };
  });
}

/**
 * Nova superfície no fim da lista. Parede repete a altura e o tipo de pintura da anterior;
 * teto e piso começam com o tipo mais comum (acrílica e piso).
 */
export function addSurface(surfaces: Surface[], kind: Kind): Surface[] {
  const lastWall = [...surfaces].reverse().find((s) => s.kind === "wall");
  const add: Surface = {
    id: crypto.randomUUID(),
    kind,
    label: "",
    widthM: 0,
    heightM: kind === "wall" ? lastWall?.heightM || 2.7 : 0,
    paint: kind === "floor" ? "piso" : kind === "wall" ? lastWall?.paint ?? "acrilica" : "acrilica",
  };
  return relabel([...surfaces, add]);
}

export const removeSurface = (surfaces: Surface[], id: string): Surface[] => relabel(surfaces.filter((s) => s.id !== id));

/** Ambiente novo, já com a Parede 1 pronta para medir. */
export function blankRoom(index: number): VisitRoom {
  return { id: crypto.randomUUID(), name: `Ambiente ${index}`, lengthM: 0, widthM: 0, heightM: 2.7, condition: "pintada", doors: 1, windows: 1, surfaces: addSurface([], "wall") };
}

/** Cópia das superfícies com ids novos (para duplicar um ambiente sem misturar os dois). */
export const cloneSurfaces = (surfaces: Surface[]): Surface[] => surfaces.map((s) => ({ ...s, id: crypto.randomUUID() }));

/** Ambiente de visita antiga (comprimento × largura × altura) em paredes: 2 de cada lado e o teto. */
export function legacyToSurfaces(l: number, w: number, h: number, paint: PaintType = "acrilica"): Surface[] {
  const wall = (width: number): Surface => ({ id: crypto.randomUUID(), kind: "wall", label: "", widthM: width, heightM: h, paint });
  const list: Surface[] = [wall(l), wall(w), wall(l), wall(w)];
  if (l > 0 && w > 0) list.push({ id: crypto.randomUUID(), kind: "ceiling", label: "", widthM: l, heightM: w, paint });
  return relabel(list);
}

const openingsFor = (doors: number, windows: number): Opening[] => [...(doors ? [door(doors)] : []), ...(windows ? [win(windows)] : [])];
export const openingCount = (room: Pick<Room, "openings">, kind: Opening["kind"]): number => room.openings.filter((o) => o.kind === kind).reduce((a, o) => a + o.qty, 0);

/** Resumo em m²: "Paredes 45,7 m² · Teto 20 m²". Vazio enquanto nada foi medido. */
export function surfacesSummary(surfaces: Surface[], doors: number, windows: number): string {
  const m = measureRoom({ id: "x", name: "x", lengthM: 0, widthM: 0, heightM: 0, openings: openingsFor(doors, windows), services: [], surfaces });
  const f = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
  return [m.wallsNetM2 > 0 ? `Paredes ${f(m.wallsNetM2)}` : null, m.ceilingM2 > 0 ? `Teto ${f(m.ceilingM2)}` : null, m.floorM2 > 0 ? `Piso ${f(m.floorM2)}` : null].filter(Boolean).join(" · ");
}

/** Área total medida de um ambiente da visita (paredes sem aberturas + teto + piso), em m². */
export function visitRoomM2(r: Pick<VisitRoom, "surfaces" | "lengthM" | "widthM" | "heightM" | "doors" | "windows">): number {
  const surfaces = r.surfaces?.length ? r.surfaces : legacyToSurfaces(r.lengthM, r.widthM, r.heightM);
  const m = measureRoom({ id: "x", name: "x", lengthM: 0, widthM: 0, heightM: 0, openings: openingsFor(r.doors, r.windows), services: [], surfaces });
  return m.wallsNetM2 + m.ceilingM2 + m.floorM2;
}

/** Resumo do bloco Medidas: "Sala · 21,42 m²", "3 ambientes · 58,10 m²" ou "Nenhuma medida". */
export function measuresSummary(rooms: Pick<VisitRoom, "name" | "surfaces" | "lengthM" | "widthM" | "heightM" | "doors" | "windows">[]): string {
  if (rooms.length === 0) return "Nenhuma medida";
  const total = rooms.reduce((n, r) => n + visitRoomM2(r), 0);
  const f = `${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  return rooms.length === 1 ? `${rooms[0]!.name} · ${f}` : `${rooms.length} ambientes · ${f}`;
}

const PAINT_SERVICE_IDS = [...new Set(Object.values(PAINT_SERVICE).flatMap((p) => Object.values(p)))];
const area = (s: Surface) => s.widthM * s.heightM;

/** Serviços de pintura que as superfícies medidas pedem (só as que já têm medida). */
export function requiredPaintServices(surfaces: Surface[]): string[] {
  return [...new Set(surfaces.filter((s) => area(s) > 0).map((s) => PAINT_SERVICE[s.paint]?.[s.kind]).filter((id): id is string => !!id))];
}

/**
 * Mantém os serviços de pintura coerentes com o que foi medido: acrescenta os que faltam (se o pintor oferece)
 * e tira os que já não têm superfície. Preparo, proteção e portas/janelas não são mexidos.
 */
export function syncPaintServices(room: Room, enabled: string[]): Room {
  if (!room.surfaces?.length) return room;
  const need = requiredPaintServices(room.surfaces).filter((id) => enabled.includes(id));
  const kept = room.services.filter((s) => !PAINT_SERVICE_IDS.includes(s.serviceId) || need.includes(s.serviceId));
  const have = new Set(kept.map((s) => s.serviceId));
  return { ...room, services: [...kept, ...need.filter((id) => !have.has(id)).map((serviceId) => ({ serviceId }))] };
}

/** Troca o estado das paredes: refaz os serviços de preparo (lixar, massa, selador…). */
export function setRoomCondition(room: Room, condition: string, enabled: string[]): Room {
  const prep = suggestServices(condition, enabled).filter((id) => id !== "pintura_parede");
  const kept = room.services.filter((s) => !CONDITION_SERVICE_IDS.includes(s.serviceId));
  const have = new Set(kept.map((s) => s.serviceId));
  return { ...room, wallCondition: condition, services: [...prep.filter((id) => !have.has(id)).map((serviceId) => ({ serviceId })), ...kept] };
}

/** Ambiente anotado na visita -> ambiente do orçamento. Visita antiga (sem paredes) usa o jeito antigo. */
export function visitRoomToRoom(vr: VisitRoom, enabled: string[]): Room {
  if (!vr.surfaces?.length) return roomFromForm(vr, enabled, vr.id, vr.name);
  const base: Room = {
    id: vr.id,
    name: vr.name.trim() || "Ambiente",
    lengthM: 0,
    widthM: 0,
    heightM: vr.heightM,
    wallCondition: vr.condition,
    openings: openingsFor(vr.doors, vr.windows),
    surfaces: vr.surfaces,
    services: [],
  };
  const fixed = ["protecao", "protecao_vaos", ...(vr.doors ? ["portas"] : []), ...(vr.windows ? ["janelas"] : [])].filter((id) => enabled.includes(id));
  const withPrep = setRoomCondition({ ...base, services: fixed.map((serviceId) => ({ serviceId })) }, vr.condition, enabled);
  return syncPaintServices(withPrep, enabled);
}

/** Aplica a edição de medidas (nome, paredes, portas, janelas) a um ambiente do orçamento. */
export function applyDraft(room: Room, d: RoomDraft, enabled: string[]): Room {
  const wasDoors = openingCount(room, "door");
  const wasWindows = openingCount(room, "window");
  const sameOpenings = wasDoors === d.doors && wasWindows === d.windows;
  const services = [...room.services];
  const toggle = (id: string, on: boolean) => {
    const i = services.findIndex((s) => s.serviceId === id);
    if (on && i === -1 && enabled.includes(id)) services.push({ serviceId: id });
    if (!on && i !== -1) services.splice(i, 1);
  };
  if (wasDoors > 0 !== d.doors > 0) toggle("portas", d.doors > 0);
  if (wasWindows > 0 !== d.windows > 0) toggle("janelas", d.windows > 0);
  return syncPaintServices({ ...room, name: d.name, surfaces: d.surfaces, openings: sameOpenings ? room.openings : openingsFor(d.doors, d.windows), services }, enabled);
}

export const draftOf = (room: Room): RoomDraft => ({ name: room.name, surfaces: room.surfaces ?? [], doors: openingCount(room, "door"), windows: openingCount(room, "window") });
