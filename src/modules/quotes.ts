import { calculateQuote, ENGINE_VERSION } from "@/engine";
import { uid, updateDb } from "./db";
import { buildEngineConfig } from "./settings";
import type { Db, Quote, QuoteInput, QuoteResult, QuoteStatus, Work } from "./types";

export const VALIDITY_DAYS = 7;

export const previewQuote = (input: QuoteInput, db: Db): QuoteResult => calculateQuote(input, buildEngineConfig(db));

interface NewQuote {
  clientId: string;
  visitId?: string;
  siteAddress: string;
  input: QuoteInput;
  paymentTerms: string;
  notes: string;
  showRoomPrices?: boolean;
  paymentLink?: string;
  depositPct?: number;
}

export function saveQuote(db: Db, data: NewQuote): string {
  const config = buildEngineConfig(db);
  const result = calculateQuote(data.input, config);
  const now = new Date();
  const id = uid();
  const quote: Quote = {
    id,
    number: db.counters.quote + 1,
    ...data,
    status: "open",
    createdAt: now.toISOString(),
    validUntil: new Date(now.getTime() + VALIDITY_DAYS * 86400000).toISOString(),
    configSnapshot: config,
    engineVersion: ENGINE_VERSION,
    result,
  };
  updateDb((d) => ({
    ...d,
    quotes: [quote, ...d.quotes],
    visits: d.visits.map((v) => (v.id === data.visitId ? { ...v, quoteId: id, clientId: v.clientId ?? data.clientId } : v)),
    counters: { quote: quote.number },
  }));
  return id;
}

const DAY = 86400000;

/** Edita um orçamento ainda não fechado. Recalcula com os valores ATUAIS dos Ajustes. */
export function updateQuote(db: Db, id: string, data: Pick<Quote, "siteAddress" | "input" | "paymentTerms" | "notes" | "showRoomPrices" | "paymentLink" | "depositPct">): void {
  const config = buildEngineConfig(db);
  const result = calculateQuote(data.input, config);
  const now = new Date();
  updateDb((d) => ({
    ...d,
    quotes: d.quotes.map((q) =>
      q.id !== id
        ? q
        : {
            ...q,
            ...data,
            configSnapshot: config,
            engineVersion: ENGINE_VERSION,
            result,
            revision: (q.revision ?? 0) + 1,
            revisedAt: now.toISOString(),
            validUntil: new Date(now.getTime() + VALIDITY_DAYS * DAY).toISOString(),
          },
    ),
  }));
}

/** Cria uma cópia (novo número, status Aberto, validade nova), recalculada com os valores atuais. */
export function duplicateQuote(db: Db, id: string): string | null {
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return null;
  return saveQuote(db, {
    clientId: q.clientId,
    siteAddress: q.siteAddress,
    input: JSON.parse(JSON.stringify(q.input)) as QuoteInput,
    paymentTerms: q.paymentTerms,
    notes: q.notes,
    showRoomPrices: q.showRoomPrices,
    paymentLink: q.paymentLink,
    depositPct: q.depositPct,
  });
}

/** Apaga o orçamento e a obra criada a partir dele. */
export function deleteQuote(id: string): void {
  updateDb((db) => ({
    ...db,
    quotes: db.quotes.filter((q) => q.id !== id),
    works: db.works.filter((w) => w.quoteId !== id),
    visits: db.visits.map((v) => (v.quoteId === id ? { ...v, quoteId: undefined } : v)),
  }));
}

/** Fechado vira obra automaticamente (uma vez). */
export function setQuoteStatus(quoteId: string, status: QuoteStatus): void {
  updateDb((db) => {
    const quotes = db.quotes.map((q) =>
      q.id === quoteId ? { ...q, status, closedAt: status === "open" ? undefined : new Date().toISOString() } : q,
    );
    const q = quotes.find((x) => x.id === quoteId);
    let works = db.works;
    if (q && status === "won" && !works.some((w) => w.quoteId === quoteId)) {
      const client = db.clients.find((c) => c.id === q.clientId);
      const work: Work = {
        id: uid(),
        quoteId,
        clientId: q.clientId,
        title: `${client?.name ?? "Obra"} — ${q.siteAddress || "sem endereço"}`,
        status: "scheduled",
        createdAt: new Date().toISOString(),
        plannedDays: q.result.schedule.totalDays,
        plannedHours: q.result.schedule.hours,
        plannedTotalCents: q.result.totals.totalCents,
        plannedCostCents: q.result.totals.costCents,
      };
      works = [work, ...works];
    }
    return { ...db, quotes, works };
  });
}

export const isExpired = (q: Quote): boolean => q.status === "open" && new Date(q.validUntil).getTime() < Date.now();
