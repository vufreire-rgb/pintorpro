import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(async () => undefined), getFile: vi.fn(async () => undefined), deleteFile: vi.fn(async () => undefined) }));

import { deleteClient, updateClient } from "./clients";
import { newDb } from "./db";
import { deleteQuote, duplicateQuote, saveQuote, setQuoteStatus, updateQuote } from "./quotes";
import { deleteVisit } from "./visits";
import { deleteWork } from "./works";
import type { Db, QuoteInput } from "./types";

const read = (): Db => JSON.parse(store.get("pintorpro:v1")!) as Db;
const write = (db: Db) => store.set("pintorpro:v1", JSON.stringify(db));

const input = (width: number): QuoteInput => ({
  rooms: [{ id: "r1", name: "Sala", lengthM: width, widthM: 4, heightM: 2.5, openings: [], services: [{ serviceId: "pintura_parede" }] }],
  extras: [],
});

function setup(): Db {
  const db = newDb();
  db.company = { name: "T", whatsapp: "1", city: "c", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" };
  db.clients = [{ id: "c1", name: "Ana", phone: "1", address: "Rua A" }];
  db.visits = [{ id: "v1", clientId: "c1", siteAddress: "Rua A", notes: "n", photoIds: ["p1"], audios: [{ id: "a1", seconds: 3, createdAt: "", mime: "audio/wav" }], createdAt: "2026-10-01T00:00:00Z" }];
  write(db);
  return db;
}

const make = (width = 5) => {
  const db = read();
  return saveQuote(db, { clientId: "c1", visitId: "v1", siteAddress: "Rua A", input: input(width), paymentTerms: "50/50", notes: "" });
};

beforeEach(() => {
  store.clear();
  setup();
});

describe("orçamentos: editar, duplicar, apagar", () => {
  it("editar recalcula o preço, mantém número e status e conta a revisão", () => {
    const id = make(5);
    const before = read().quotes[0]!;
    updateQuote(read(), id, { siteAddress: "Rua B", input: input(8), paymentTerms: "à vista", notes: "x" });
    const after = read().quotes[0]!;
    expect(after.number).toBe(before.number);
    expect(after.status).toBe("open");
    expect(after.revision).toBe(1);
    expect(after.siteAddress).toBe("Rua B");
    expect(after.result.totals.totalCents).toBeGreaterThan(before.result.totals.totalCents);
    expect(Date.parse(after.validUntil)).toBeGreaterThanOrEqual(Date.parse(before.validUntil));
  });

  it("duplicar cria outro orçamento Aberto, com número novo, sem mexer no original", () => {
    const id = make(5);
    setQuoteStatus(id, "won");
    const copy = duplicateQuote(read(), id)!;
    const db = read();
    expect(db.quotes).toHaveLength(2);
    const orig = db.quotes.find((q) => q.id === id)!;
    const dup = db.quotes.find((q) => q.id === copy)!;
    expect(orig.status).toBe("won");
    expect(dup.status).toBe("open");
    expect(dup.number).toBe(orig.number + 1);
    expect(dup.result.totals.totalCents).toBe(orig.result.totals.totalCents);
    expect(db.works).toHaveLength(1); // duplicar não cria obra
  });

  it("apagar remove o orçamento e a obra dele, e solta a visita", () => {
    const id = make();
    setQuoteStatus(id, "won");
    expect(read().works).toHaveLength(1);
    deleteQuote(id);
    const db = read();
    expect(db.quotes).toHaveLength(0);
    expect(db.works).toHaveLength(0);
    expect(db.visits[0]!.quoteId).toBeUndefined();
  });

  it("apagar uma obra mantém o orçamento", () => {
    const id = make();
    setQuoteStatus(id, "won");
    deleteWork(read().works[0]!.id);
    expect(read().works).toHaveLength(0);
    expect(read().quotes).toHaveLength(1);
  });
});

describe("visitas e clientes", () => {
  it("apagar visita remove a visita e não toca no orçamento", async () => {
    make();
    await deleteVisit("v1", read().visits);
    expect(read().visits).toHaveLength(0);
    expect(read().quotes).toHaveLength(1);
  });

  it("não apaga cliente com visita ou orçamento; apaga quando está livre", async () => {
    make();
    expect(deleteClient(read(), "c1")).toMatch(/1 visita.*1 orçamento/);
    expect(read().clients).toHaveLength(1);
    deleteQuote(read().quotes[0]!.id);
    await deleteVisit("v1", read().visits);
    expect(deleteClient(read(), "c1")).toBeNull();
    expect(read().clients).toHaveLength(0);
  });

  it("editar cliente altera só aquele cliente", () => {
    updateClient("c1", { name: "Ana Maria", phone: "2", address: "Rua Z" });
    expect(read().clients[0]).toMatchObject({ id: "c1", name: "Ana Maria", address: "Rua Z" });
  });
});
