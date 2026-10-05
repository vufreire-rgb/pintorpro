import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";
import { clientTextFor, DEFAULT_PDF_TEXTS, PREP_SERVICE_IDS, serviceOrder } from "./catalog";
import type { Db, Quote } from "./types";

/** Tudo que o PDF do cliente mostra. Por construção NÃO contém custo, lucro ou margem. */
export interface QuotePdfData {
  color: string;
  tint: string;
  /** Logo do pintor como data URL; ausente = monograma com iniciais. */
  logo?: string;
  painter: { company: string; initials: string; contact: string; whatsapp: string };
  number: string;
  date: string;
  clientName: string;
  siteAddress: string;
  summary: string;
  total: string;
  days: string;
  payment: string;
  validity: string;
  deposit: null | { amount: string; pct: string; link: string };
  /** Pix da entrada: QR (imagem) e o código "copia e cola". */
  pix?: { qr: string; code: string; amount: string; pct: string; receiver: string };
  rooms: { name: string; facts: string; items: string[]; materials: string; price?: string }[];
  showRoomPrices: boolean;
  terms: { exclusions: string[]; before: string[]; warranty: string };
  notes: string;
  photos: { src: string; room: string; caption: string }[];
}

export const MAX_PDF_PHOTOS = 6;

/** "Silva Pinturas" -> "SP"; "joão" -> "J". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!;
  return letters.toUpperCase();
}

/** 8% da cor misturada com branco: é o "tom claro dos blocos" da ficha do designer. */
export function tintOf(hex: string, amount = 0.08): string {
  const h = hex.replace("#", "");
  const mix = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c * amount + 255 * (1 - amount));
  };
  return "#" + [0, 2, 4].map((i) => mix(i).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const padNumber = (n: number): string => String(n).padStart(4, "0");

/** Um item por linha, sem linhas vazias. */
export const listFromText = (text: string | undefined, fallback: string): string[] =>
  (text ?? fallback).split("\n").map((l) => l.trim()).filter(Boolean);

const area = (n: number): string => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)} m²`;

const joinPt = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

/** Distribui `total` proporcionalmente aos pesos; a soma fecha exatamente (sobra vai ao maior). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => Math.round((total * w) / sum));
  const diff = total - parts.reduce((a, b) => a + b, 0);
  const biggest = weights.indexOf(Math.max(...weights));
  parts[biggest] = parts[biggest]! + diff;
  return parts;
}

export function buildPdfData(db: Db, q: Quote, photos: QuotePdfData["photos"] = []): QuotePdfData {
  const c = db.company;
  const client = db.clients.find((x) => x.id === q.clientId);
  const services = new Map(q.configSnapshot.services.map((s) => [s.id, s]));
  const materials = new Map(q.configSnapshot.materials.map((m) => [m.id, m]));
  const included = (id: string) => q.input.materialsIncluded?.[id] ?? true;

  const rooms = q.input.rooms
    .map((room, i) => {
      const m = q.result.measures[i]!;
      const lines = q.result.serviceLines.filter((l) => l.roomId === room.id);
      const sel = [...room.services].sort((a, b) => serviceOrder(a.serviceId) - serviceOrder(b.serviceId));
      const items = sel
        .map((s) => {
          const svc = services.get(s.serviceId);
          const line = lines.find((l) => l.serviceId === s.serviceId);
          return svc && line ? clientTextFor(svc, line.coats) : null;
        })
        .filter((t): t is string => !!t);
      const bases = new Set(sel.map((s) => services.get(s.serviceId)?.basis));
      const facts = [
        bases.has("walls_area") && m.wallsNetM2 > 0 ? `${area(m.wallsNetM2)} de parede` : null,
        bases.has("ceiling_area") && m.ceilingM2 > 0 ? `${area(m.ceilingM2)} de teto` : null,
        m.doorCount ? `${m.doorCount} ${m.doorCount === 1 ? "porta" : "portas"}` : null,
        m.windowCount ? `${m.windowCount} ${m.windowCount === 1 ? "janela" : "janelas"}` : null,
      ].filter((x): x is string => !!x);
      const names = [...new Set(sel.flatMap((s) => services.get(s.serviceId)?.materialIds ?? []))]
        .filter(included)
        .map((id) => materials.get(id)?.name)
        .filter((n): n is string => !!n)
        .map((n) => n.charAt(0).toLowerCase() + n.slice(1));
      const matText = names.length ? joinPt(names) : "";
      return {
        name: room.name,
        facts: facts.join(" · "),
        items,
        materials: matText ? matText.charAt(0).toUpperCase() + matText.slice(1) + "." : "",
        weight: lines.reduce((a, l) => a + l.totalCents, 0),
        wall: bases.has("walls_area") ? m.wallsNetM2 : 0,
        ceiling: bases.has("ceiling_area") ? m.ceilingM2 : 0,
        prep: sel.some((s) => PREP_SERVICE_IDS.includes(s.serviceId)),
      };
    })
    .filter((r) => r.items.length > 0);

  const prices = allocate(q.result.totals.totalCents, rooms.map((r) => r.weight));
  const wall = rooms.reduce((a, r) => a + r.wall, 0);
  const ceiling = rooms.reduce((a, r) => a + r.ceiling, 0);
  const parts = [rooms.some((r) => r.prep) ? "preparação" : null, q.result.materialLines.some((l) => l.included) ? "tinta" : null, "mão de obra"].filter((x): x is string => !!x);
  const measures = [wall > 0 ? `${area(wall)} de paredes` : null, ceiling > 0 ? `${area(ceiling)} de teto` : null].filter((x): x is string => !!x);
  const roomNames = rooms.length > 0 && rooms.length <= 4 ? `, ${joinPt(rooms.map((r) => r.name.toLowerCase()))}` : "";
  const summary = rooms.length
    ? `Pintura de ${rooms.length} ${rooms.length === 1 ? "ambiente" : "ambientes"}${roomNames}${measures.length ? `: ${joinPt(measures)}` : ""}, com ${joinPt(parts)}.`
    : "";

  const total = q.result.totals.totalCents;
  const pct = q.depositPct ?? c?.depositPct ?? 50;
  const days = q.result.schedule.totalDays;

  return {
    color: c?.brandColor ?? "#0F3B7A",
    tint: tintOf(c?.brandColor ?? "#0F3B7A"),
    painter: {
      company: c?.name ?? "",
      initials: initialsOf(c?.name ?? ""),
      contact: [c?.ownerName, c?.city].filter(Boolean).join(" · "),
      whatsapp: c?.whatsapp ?? "",
    },
    number: padNumber(q.number),
    date: fmtDate(q.revisedAt ?? q.createdAt),
    clientName: client?.name ?? "",
    siteAddress: q.siteAddress,
    summary,
    total: formatBRL(total),
    days: days > 0 ? `${days} ${days === 1 ? "dia útil" : "dias úteis"}` : "A combinar",
    payment: q.paymentTerms,
    validity: `7 dias, até ${fmtDate(q.validUntil)}`,
    deposit: q.paymentLink?.trim() ? { amount: formatBRL(Math.round((total * pct) / 100)), pct: `${pct}% do valor total.`, link: q.paymentLink.trim() } : null,
    rooms: rooms.map((r, i) => ({ name: r.name, facts: r.facts, items: r.items, materials: r.materials, price: q.showRoomPrices ? formatBRL(prices[i]!) : undefined })),
    showRoomPrices: !!q.showRoomPrices,
    terms: {
      exclusions: listFromText(c?.exclusionsText, DEFAULT_PDF_TEXTS.exclusionsText),
      before: listFromText(c?.beforeStartText, DEFAULT_PDF_TEXTS.beforeStartText),
      warranty: (c?.warrantyText ?? DEFAULT_PDF_TEXTS.warrantyText).trim(),
    },
    notes: q.notes.trim(),
    photos: photos.slice(0, MAX_PDF_PHOTOS),
  };
}
