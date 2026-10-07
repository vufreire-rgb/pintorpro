import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
const sendVoice = vi.fn();
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false, sendVoice: (b: Blob) => sendVoice(b) }));
const files = new Map<string, Blob>();
vi.mock("@/repositories/fileStore", () => ({
  putFile: async (id: string, b: Blob) => void files.set(id, b),
  getFile: async (id: string) => files.get(id),
  deleteFile: async (id: string) => void files.delete(id),
}));

import { newDb } from "./db";
import { discardVoice, listPendingVoice, processPendingVoice, queueVoice, quoteFromVoice, saveVoiceQuote, voiceFailureText, type VoiceDraft } from "./voice";
import type { Db } from "./types";

const setup = (): Db => {
  const db = newDb();
  db.company = { name: "T", whatsapp: "1", city: "c", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" };
  return db;
};
const room = { name: "Sala", lengthM: 4, widthM: 5, heightM: 2.7, wallAreaM2: 0, includeCeiling: true, paint: "acrilica" as const, condition: "pintada", doors: 1, windows: 1 };
const draft = (p: Partial<VoiceDraft> = {}): VoiceDraft => ({ clientName: "Maria", phone: "11988887777", address: "Rua A, 10", rooms: [room], closedPriceReais: 0, paymentTerms: "", notes: "", ...p });

beforeEach(() => { store.clear(); files.clear(); sendVoice.mockReset(); });

describe("quoteFromVoice", () => {
  it("sem preço fechado calcula pelos preços do pintor", () => {
    const q = quoteFromVoice(setup(), draft());
    expect(q.rooms).toHaveLength(1);
    expect(q.rooms[0]!.surfaces).toHaveLength(5); // 4 paredes + teto
    expect(q.adjustment).toBeUndefined();
    expect(q.totalCents).toBeGreaterThan(0);
  });
  it("preço fechado deixa o total exatamente no valor dito (acima e abaixo do cálculo)", () => {
    for (const price of [100, 2800, 99999]) {
      expect(quoteFromVoice(setup(), draft({ closedPriceReais: price })).totalCents).toBe(price * 100);
    }
  });
  it("só preço, sem medidas: vira um item único", () => {
    const q = quoteFromVoice(setup(), draft({ rooms: [], closedPriceReais: 1500 }));
    expect(q.rooms).toHaveLength(0);
    expect(q.extras).toHaveLength(1);
    expect(q.totalCents).toBe(150000);
  });
  it("ambiente sem medida fica de fora e é avisado; área de parede serve", () => {
    const q = quoteFromVoice(setup(), draft({ rooms: [{ ...room, name: "Quarto", lengthM: 0, widthM: 0, includeCeiling: false }, { ...room, name: "Cozinha", lengthM: 0, widthM: 0, wallAreaM2: 30 }] }));
    expect(q.skippedRooms).toEqual(["Quarto"]);
    expect(q.rooms.map((r) => r.name)).toEqual(["Cozinha"]);
  });
  it("com medidas mostra custo e lucro; preço baixo demais aparece como prejuízo", () => {
    const ok = quoteFromVoice(setup(), draft());
    expect(ok.priceOnly).toBe(false);
    expect(ok.costCents).toBeGreaterThan(0);
    expect(ok.profitCents).toBe(ok.totalCents - ok.costCents);
    expect(quoteFromVoice(setup(), draft({ closedPriceReais: 50 })).profitCents).toBeLessThan(0);
  });
  it("só preço: sem custo nem lucro", () => {
    const q = quoteFromVoice(setup(), draft({ rooms: [], closedPriceReais: 1500 }));
    expect(q.priceOnly).toBe(true);
    expect(q.costCents).toBe(0);
  });
  it("modo simples ignora as medidas ditadas e usa só o preço", () => {
    const q = quoteFromVoice(setup(), draft({ closedPriceReais: 2000 }), { simple: true, description: "Pintura da sala" });
    expect(q.rooms).toHaveLength(0);
    expect(q.skippedRooms).toHaveLength(0);
    expect(q.extras[0]!.description).toBe("Pintura da sala");
    expect(q.totalCents).toBe(200000);
    expect(q.priceOnly).toBe(true);
  });
  it("modo simples sem preço: total zero", () => {
    expect(quoteFromVoice(setup(), draft(), { simple: true }).totalCents).toBe(0);
  });
  it("sem nada, total zero", () => {
    expect(quoteFromVoice(setup(), draft({ rooms: [] })).totalCents).toBe(0);
  });
});

describe("saveVoiceQuote", () => {
  it("cria o cliente e salva o orçamento com o total certo", () => {
    const db = setup();
    store.set("pintorpro:v1", JSON.stringify(db));
    const quote = quoteFromVoice(db, draft({ closedPriceReais: 2800 }));
    saveVoiceQuote(db, { clientName: "Maria", phone: "1", address: "Rua A", paymentTerms: "", notes: "", quote });
    const saved = JSON.parse(store.get("pintorpro:v1")!) as Db;
    expect(saved.clients.map((c) => c.name)).toEqual(["Maria"]);
    expect(saved.quotes[0]!.result.totals.totalCents).toBe(280000);
    expect(saved.quotes[0]!.paymentTerms).toBe("50/50");
  });
});

describe("saveVoiceQuote a partir da visita", () => {
  it("usa o cliente da visita e liga o orçamento à visita", () => {
    const db = setup();
    db.clients = [{ id: "c1", name: "Seu Carlos", phone: "1", address: "Av. Brasil" }];
    db.visits = [{ id: "v1", clientId: "c1", siteAddress: "Av. Brasil", notes: "", photoIds: [], createdAt: "2026-10-01T00:00:00Z" }];
    store.set("pintorpro:v1", JSON.stringify(db));
    const quote = quoteFromVoice(db, draft({ closedPriceReais: 900 }));
    saveVoiceQuote(db, { clientName: "Nome Ditado", phone: "", address: "Av. Brasil", paymentTerms: "", notes: "", quote, clientId: "c1", visitId: "v1" });
    const saved = JSON.parse(store.get("pintorpro:v1")!) as Db;
    expect(saved.clients).toHaveLength(1);
    expect(saved.quotes[0]).toMatchObject({ clientId: "c1", visitId: "v1" });
    expect(saved.visits[0]!.quoteId).toBe(saved.quotes[0]!.id);
  });
});

describe("voiceFailureText", () => {
  it("códigos conhecidos e desconhecidos viram texto em português", () => {
    expect(voiceFailureText("daily_limit")).toMatch(/limite/);
    expect(voiceFailureText("qualquer coisa")).toMatch(/Não consegui/);
  });
});

describe("áudio guardado sem internet", () => {
  const blob = new Blob(["x"], { type: "audio/wav" });
  it("guarda o áudio e mantém se continuar sem internet", async () => {
    await queueVoice(blob, 12);
    const [p] = listPendingVoice();
    expect(p).toMatchObject({ status: "waiting", seconds: 12 });
    sendVoice.mockRejectedValue(new Error("network"));
    await expect(processPendingVoice(p!.id)).rejects.toThrow("network");
    expect(files.size).toBe(1);
    expect(listPendingVoice()[0]!.status).toBe("waiting");
  });
  it("quando a internet volta, guarda o rascunho e apaga o áudio", async () => {
    await queueVoice(blob, 5);
    sendVoice.mockResolvedValue({ transcript: "oi", draft: draft() });
    const done = await processPendingVoice(listPendingVoice()[0]!.id);
    expect(done.status).toBe("ready");
    expect(done.draft?.clientName).toBe("Maria");
    expect(files.size).toBe(0);
    await discardVoice(done.id);
    expect(listPendingVoice()).toHaveLength(0);
  });
  it("limita a fila a 10 áudios", async () => {
    for (let i = 0; i < 10; i++) await queueVoice(blob, 1);
    await expect(queueVoice(blob, 1)).rejects.toThrow("queue_full");
  });
});
