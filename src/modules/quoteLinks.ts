import { useEffect, useState } from "react";
import { fetchSharedQuote, listQuoteLinks, publishQuoteLink, revokeQuoteLink, type QuoteLinkRow } from "@/repositories/cloudStore";
import { cloudEnabled } from "./auth";
import { buildPdfData } from "./pdfData";
import { publicOrigin } from "./publicOrigin";
import { normalizePixKey, pixPayload, pixText } from "./pix";
import { formatBRL } from "@/shared/money";
import type { Db, Quote } from "./types";

/** O que o cliente vê no link. Espelha supabase/functions/quote-link/logic.ts. Nunca tem custo, lucro, fotos nem logo. */
export interface SharedQuote {
  v: 1;
  color: string;
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
  validUntil: string;
  deposit: { amount: string; pct: string; link: string } | null;
  pix: { code: string; amount: string; pct: string; receiver: string } | null;
  rooms: { name: string; facts: string; items: string[]; materials: string; price: string; priceCents?: number }[];
  showRoomPrices: boolean;
  terms: { exclusions: string[]; before: string[]; warranty: string };
  notes: string;
  /** Lista de materiais (só vai quando o pintor escolheu mostrar). */
  materialsList?: string[];
}

/** Monta o que vai para o link, a partir dos mesmos dados do PDF (sem fotos e sem logo). */
export function buildShareSnapshot(db: Db, q: Quote): SharedQuote {
  const d = buildPdfData(db, q);
  let pix: SharedQuote["pix"] = null;
  const px = db.company?.pix;
  if (px && db.company && normalizePixKey(px.type, px.key)) {
    const pct = q.depositPct ?? db.company.depositPct ?? 50;
    const cents = Math.round((q.result.totals.totalCents * pct) / 100);
    const code = pixPayload(px, { name: db.company.name, city: db.company.city }, cents);
    if (code) pix = { code, amount: formatBRL(cents), pct: `${pct}% do valor total.`, receiver: pixText(px.name || db.company.name, 25) };
  }
  return {
    v: 1,
    color: d.color,
    painter: d.painter,
    number: d.number,
    date: d.date,
    clientName: d.clientName,
    siteAddress: d.siteAddress,
    summary: d.summary,
    total: d.total,
    days: d.days,
    payment: d.payment,
    validity: d.validity,
    validUntil: q.validUntil,
    deposit: d.deposit,
    pix,
    // No link o cliente sempre vê o valor de cada ambiente (ele escolhe quais fechar).
    rooms: d.rooms.map((r) => ({ name: r.name, facts: r.facts, items: r.items, materials: r.materials, price: formatBRL(r.priceCents ?? 0), priceCents: r.priceCents ?? 0 })),
    showRoomPrices: true,
    terms: d.terms,
    notes: d.notes,
    ...(d.materialsList.length ? { materialsList: d.materialsList } : {}),
  };
}

export const linkUrl = (token: string): string => `${publicOrigin()}/o/${token}`;

/** Publica o link do orçamento (ou atualiza o que o cliente vê) e devolve o endereço. */
export async function publishLinkFor(db: Db, q: Quote): Promise<string> {
  return linkUrl(await publishQuoteLink(q.id, buildShareSnapshot(db, q)));
}

/** Apaga o link, se existir. Não falha: o orçamento some do app de qualquer jeito. */
export const unpublishLinkFor = (quoteId: string): Promise<void> => revokeQuoteLink(quoteId).catch(() => undefined);

/** Mensagem de WhatsApp com o link. */
export function linkMessage(clientName: string, company: string, number: string, url: string, total?: string): string {
  const first = clientName.trim().split(/\s+/)[0] ?? "";
  return [`Olá${first ? `, ${first}` : ""}! Aqui está o seu orçamento nº ${number} da ${company}:`, url, ...(total ? [`Valor total: ${total}`] : []), "É só abrir o link para ver os detalhes."].join("\n");
}

export type QuoteLink = { token: string; views: number; firstViewedAt: string | null; lastViewedAt: string | null; updatedAt: string; acceptedAt?: string | null; acceptedRooms?: string[]; acceptedTotalCents?: number | null };

/** "há 5 min", "há 2 h", "há 3 dias". */
export function agoLabel(iso: string, now: number = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** Frase para o pintor: se o cliente já abriu o link. */
export function viewedLabel(link: QuoteLink | undefined, now: number = Date.now()): string {
  if (!link) return "";
  if (!link.views || !link.lastViewedAt) return "Link enviado. O cliente ainda não abriu.";
  return `O cliente abriu ${link.views === 1 ? "1 vez" : `${link.views} vezes`}. Última ${agoLabel(link.lastViewedAt, now)}.`;
}

/** Frase para o pintor: o cliente tocou em "Fechar agora". "" se ainda não. */
export function acceptedLabel(link: QuoteLink | undefined, now: number = Date.now()): string {
  if (!link?.acceptedAt) return "";
  const rooms = link.acceptedRooms ?? [];
  const what = rooms.length ? rooms.join(", ") : "o orçamento inteiro";
  const value = link.acceptedTotalCents ? ` (${formatBRL(link.acceptedTotalCents)})` : "";
  return `O cliente pediu para fechar ${agoLabel(link.acceptedAt, now)}: ${what}${value}.`;
}

/** O orçamento foi editado depois da última vez que o link foi atualizado? */
export const linkIsStale = (q: Pick<Quote, "revisedAt">, link: QuoteLink | undefined): boolean =>
  !!link && !!q.revisedAt && Date.parse(q.revisedAt) > Date.parse(link.updatedAt) + 1000;

/** Links do pintor (por id do orçamento) com as visualizações. Atualiza ao abrir a tela e ao voltar para o app. */
export function useQuoteLinks(): { links: Record<string, QuoteLink>; reload: () => void } {
  const [links, setLinks] = useState<Record<string, QuoteLink>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    listQuoteLinks()
      .then((rows: QuoteLinkRow[]) => {
        if (!alive) return;
        setLinks(Object.fromEntries(rows.map((r) => [r.quote_id, { token: r.token, views: r.views_count, firstViewedAt: r.first_viewed_at, lastViewedAt: r.last_viewed_at, updatedAt: r.updated_at, acceptedAt: r.accepted_at ?? null, acceptedRooms: Array.isArray(r.accepted_rooms) ? r.accepted_rooms : [], acceptedTotalCents: r.accepted_total_cents ?? null }])));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [tick]);
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return { links, reload: () => setTick((t) => t + 1) };
}

/** Busca o orçamento do link (página pública do cliente). */
export const loadSharedQuote = async (token: string): Promise<SharedQuote> => (await fetchSharedQuote(token)) as SharedQuote;

/** Publica o link e abre o compartilhamento do celular (ou o WhatsApp) com a mensagem pronta. Devolve o endereço. */
export async function shareLinkOnWhatsApp(db: Db, q: Quote): Promise<string> {
  const url = await publishLinkFor(db, q);
  const client = db.clients.find((c) => c.id === q.clientId);
  const text = linkMessage(client?.name ?? "", db.company?.name ?? "", String(q.number).padStart(4, "0"), url, formatBRL(q.result.totals.totalCents));
  if (navigator.share) {
    try {
      await navigator.share({ text, title: `Orçamento ${q.number}` });
      return url;
    } catch (e) {
      if ((e as Error).name === "AbortError") return url;
    }
  }
  const phone = (client?.phone ?? "").replace(/\D/g, "");
  window.open(`https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(text)}`, "_blank");
  return url;
}
