import { calculateQuote, ENGINE_VERSION } from "@/engine";
import { uid, updateDb } from "./db";
import { buildEngineConfig } from "./settings";
import type { Db, Quote, QuoteInput, QuoteResult, QuoteStatus, Work } from "./types";

export const VALIDITY_DAYS = 7;

export const previewQuote = (input: QuoteInput, db: Db): QuoteResult => calculateQuote(input, buildEngineConfig(db));

interface NewQuote {
  clientId: string;
  siteAddress: string;
  input: QuoteInput;
  paymentTerms: string;
  notes: string;
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
  updateDb((d) => ({ ...d, quotes: [quote, ...d.quotes], counters: { quote: quote.number } }));
  return id;
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
