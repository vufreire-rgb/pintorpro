import { PAINT_OPTIONS } from "./catalog";
import { addClient } from "./clients";
import { previewQuote, saveQuote } from "./quotes";
import { relabel, visitRoomToRoom } from "./rooms";
import { sendVoice } from "@/repositories/cloudStore";
import type { Adjustment, Db, ExtraItem, PaintType, Room, Surface, VisitRoom } from "./types";

/** O que a IA entendeu do que o pintor ditou. Espelha supabase/functions/voice-quote/logic.ts. */
export interface VoiceRoom {
  name: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  wallAreaM2: number;
  includeCeiling: boolean;
  paint: PaintType;
  condition: string;
  doors: number;
  windows: number;
}

export interface VoiceDraft {
  clientName: string;
  phone: string;
  address: string;
  rooms: VoiceRoom[];
  closedPriceReais: number;
  paymentTerms: string;
  notes: string;
}

export type VoiceFailure = "not_configured" | "daily_limit" | "too_big" | "ai_failed" | "unauthorized" | "network";

const FAILURE_TEXT: Record<VoiceFailure, string> = {
  not_configured: "O orçamento por voz ainda não está ligado nesta conta. Avise o suporte.",
  daily_limit: "Você chegou ao limite de orçamentos por voz de hoje. Volte amanhã ou monte o orçamento digitando.",
  too_big: "O áudio ficou muito longo. Fale só o essencial (até uns 3 minutos) e tente de novo.",
  ai_failed: "Não consegui entender o áudio agora. Tente de novo em instantes.",
  unauthorized: "Sua sessão expirou. Entre de novo no app e tente outra vez.",
  network: "Sem internet. O orçamento por voz precisa de conexão. Tente de novo quando estiver online.",
};
export const voiceFailureText = (f: string): string => FAILURE_TEXT[f as VoiceFailure] ?? FAILURE_TEXT.ai_failed;

/** Envia o áudio ao servidor e devolve o texto e o rascunho. Falha com o código do problema (ver voiceFailureText). */
export async function requestVoiceDraft(audio: Blob): Promise<{ transcript: string; draft: VoiceDraft }> {
  return sendVoice(audio) as Promise<{ transcript: string; draft: VoiceDraft }>;
}

const PAINT_IDS = PAINT_OPTIONS.map((p) => p.id as string);

/** Ambiente ditado → medidas da visita. Sem medida nenhuma (nem área de parede) não dá para calcular: devolve null. */
export function voiceRoomToVisitRoom(r: VoiceRoom, index: number): VisitRoom | null {
  const paint: PaintType = PAINT_IDS.includes(r.paint) ? r.paint : "acrilica";
  const surface = (kind: Surface["kind"], widthM: number, heightM: number, p: PaintType = paint): Surface => ({ id: crypto.randomUUID(), kind, label: "", widthM, heightM, paint: p });
  let surfaces: Surface[];
  const h = r.heightM || 2.7;
  if (r.lengthM > 0 && r.widthM > 0) {
    surfaces = [surface("wall", r.lengthM, h), surface("wall", r.widthM, h), surface("wall", r.lengthM, h), surface("wall", r.widthM, h)];
    if (r.includeCeiling) surfaces.push(surface("ceiling", r.lengthM, r.widthM, "acrilica"));
  } else if (r.wallAreaM2 > 0) {
    surfaces = [surface("wall", r.wallAreaM2, 1)];
    if (r.includeCeiling && r.lengthM > 0 && r.widthM > 0) surfaces.push(surface("ceiling", r.lengthM, r.widthM, "acrilica"));
  } else return null;
  return {
    id: crypto.randomUUID(),
    name: r.name.trim() || `Ambiente ${index + 1}`,
    lengthM: 0,
    widthM: 0,
    heightM: h,
    condition: r.condition || "pintada",
    doors: r.doors,
    windows: r.windows,
    surfaces: relabel(surfaces),
  };
}

export interface VoiceQuote {
  rooms: Room[];
  extras: ExtraItem[];
  adjustment?: Adjustment;
  /** Ambientes ditados sem medida: ficaram de fora do cálculo. */
  skippedRooms: string[];
  totalCents: number;
}

/**
 * Monta o orçamento do que foi ditado. Com preço fechado, o total do orçamento fica EXATAMENTE no valor dito
 * (a diferença para o cálculo vira desconto ou acréscimo); o pintor vê isso na tela de revisão.
 */
export function quoteFromVoice(db: Db, d: VoiceDraft): VoiceQuote {
  const rooms: Room[] = [];
  const skippedRooms: string[] = [];
  d.rooms.forEach((r, i) => {
    const vr = voiceRoomToVisitRoom(r, i);
    if (vr) rooms.push(visitRoomToRoom(vr, db.enabledServiceIds));
    else skippedRooms.push(r.name.trim() || `Ambiente ${i + 1}`);
  });
  const closedCents = Math.round(d.closedPriceReais * 100);
  // Só o preço, sem medidas: vira um item único para o orçamento existir.
  const extras: ExtraItem[] = rooms.length === 0 && closedCents > 0 ? [{ description: "Serviço de pintura (preço fechado)", priceCents: closedCents, costCents: 0 }] : [];
  let adjustment: Adjustment | undefined;
  let totalCents = 0;
  if (rooms.length > 0 || extras.length > 0) {
    const base = previewQuote({ rooms, extras, adjustment: undefined }, db).totals;
    if (closedCents > 0 && base.subtotalCents !== closedCents) {
      const diff = closedCents - base.subtotalCents;
      adjustment = { type: diff < 0 ? "discount" : "surcharge", mode: "cents", value: Math.abs(diff) };
    }
    totalCents = previewQuote({ rooms, extras, adjustment }, db).totals.totalCents;
  }
  return { rooms, extras, adjustment, skippedRooms, totalCents };
}

export interface VoiceSaveInput {
  clientName: string;
  phone: string;
  address: string;
  paymentTerms: string;
  notes: string;
  quote: VoiceQuote;
}

/** Cria o cliente (se for novo) e salva o orçamento. Devolve o id para abrir a tela do orçamento. */
export function saveVoiceQuote(db: Db, s: VoiceSaveInput): string {
  const existing = db.clients.find((c) => c.name.trim().toLowerCase() === s.clientName.trim().toLowerCase());
  const clientId = existing?.id ?? addClient({ name: s.clientName.trim(), phone: s.phone.trim(), address: s.address.trim() }).id;
  return saveQuote(db, {
    clientId,
    siteAddress: s.address.trim() || existing?.address || "",
    input: { rooms: s.quote.rooms, extras: s.quote.extras, adjustment: s.quote.adjustment },
    paymentTerms: s.paymentTerms.trim() || db.company?.paymentTerms || "",
    notes: s.notes.trim(),
  });
}
