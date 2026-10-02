import { suggestServices } from "./catalog";
import type { Opening, Room, VisitRoom } from "./types";

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
