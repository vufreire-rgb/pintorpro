import { calculateQuote, ENGINE_VERSION } from "@/engine";
import { uid, updateDb } from "./db";
import { buildEngineConfig } from "./settings";
import type { Db, Quote, QuoteInput, QuoteResult, QuoteStatus, Work } from "./types";

export const VALIDITY_DAYS = 7;

/** Orçamento só com o preço (sem medidas): não há base para custo, lucro, prazo nem materiais. */
export const isPriceOnly = (q: Pick<Quote, "input">): boolean => q.input.rooms.length === 0;

export const previewQuote = (input: QuoteInput, db: Db): QuoteResult => calculateQuote(input, buildEngineConfig(db));

interface NewQuote {
  clientId: string;
  visitId?: string;
  siteAddress: string;
  input: QuoteInput;
  paymentTerms: string;
  notes: string;
  showRoomPrices?: boolean;
  materialsText?: string;
  showMaterials?: boolean;
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
export function updateQuote(db: Db, id: string, data: Pick<Quote, "siteAddress" | "input" | "paymentTerms" | "notes" | "showRoomPrices" | "paymentLink" | "depositPct"> & Partial<Pick<Quote, "materialsText" | "showMaterials">>): void {
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

/** Guarda a lista de materiais direto no orçamento (mesmo depois de enviado ou fechado). Só conta como edição quando ela aparece para o cliente. */
export function setQuoteMaterials(id: string, text: string, show: boolean): void {
  const now = new Date().toISOString();
  updateDb((d) => ({
    ...d,
    quotes: d.quotes.map((q) => (q.id !== id ? q : { ...q, materialsText: text, showMaterials: show, ...(show || q.showMaterials ? { revisedAt: now } : {}) })),
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
    materialsText: q.materialsText,
    showMaterials: q.showMaterials,
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
      q.id === quoteId ? { ...q, status, autoClosed: undefined, closedAt: status === "open" ? undefined : new Date().toISOString() } : q,
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

/** Obra recém-criada ao fechar, ainda sem nada lançado (pagamento, gasto ou data): pode sumir sem perder nada. */
export const isEmptyWork = (w: Work): boolean => w.status === "scheduled" && !w.payments?.length && !w.expenses?.length && !w.startDate;

/** A obra deste orçamento já tem dados lançados (por isso não some ao mudar a situação do orçamento). */
export const quoteWorkHasData = (db: Db, quoteId: string): boolean => db.works.some((w) => w.quoteId === quoteId && !isEmptyWork(w));

/** Marca como perdido. Se o orçamento estava fechado, a obra criada só some se ainda estiver vazia. */
export function loseQuote(quoteId: string): void {
  updateDb((db) => {
    const now = new Date().toISOString();
    const quotes = db.quotes.map((q) => (q.id === quoteId ? { ...q, status: "lost" as const, autoClosed: undefined, closedAt: now } : q));
    const works = db.works.filter((w) => !(w.quoteId === quoteId && isEmptyWork(w)));
    return { ...db, quotes, works };
  });
}

/**
 * Reabre um orçamento fechado ou perdido (vale também para "desfazer" logo depois de fechar).
 * Se a validade já passou, renova por mais um período. A obra criada ao fechar só some se ainda estiver vazia
 * (sem pagamento, sem gasto, sem data), para nunca perder nada que a pessoa lançou.
 */
export function reopenQuote(quoteId: string): void {
  updateDb((db) => {
    const now = Date.now();
    const quotes = db.quotes.map((q) =>
      q.id === quoteId
        ? { ...q, status: "open" as const, closedAt: undefined, autoClosed: undefined, validUntil: Date.parse(q.validUntil) < now ? new Date(now + VALIDITY_DAYS * DAY).toISOString() : q.validUntil }
        : q,
    );
    const works = db.works.filter((w) => !(w.quoteId === quoteId && isEmptyWork(w)));
    return { ...db, quotes, works };
  });
}

export const isExpired = (q: Quote): boolean => q.status === "open" && new Date(q.validUntil).getTime() < Date.now();
