import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false, sendVoice: vi.fn() }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn() }));

import { newDb } from "./db";
import { quoteFromVoice, saveVoiceQuote, voiceFailureText, type VoiceDraft } from "./voice";
import type { Db } from "./types";

const setup = (): Db => {
  const db = newDb();
  db.company = { name: "T", whatsapp: "1", city: "c", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" };
  return db;
};
const room = { name: "Sala", lengthM: 4, widthM: 5, heightM: 2.7, wallAreaM2: 0, includeCeiling: true, paint: "acrilica" as const, condition: "pintada", doors: 1, windows: 1 };
const draft = (p: Partial<VoiceDraft> = {}): VoiceDraft => ({ clientName: "Maria", phone: "11988887777", address: "Rua A, 10", rooms: [room], closedPriceReais: 0, paymentTerms: "", notes: "", ...p });

beforeEach(() => store.clear());

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

describe("voiceFailureText", () => {
  it("códigos conhecidos e desconhecidos viram texto em português", () => {
    expect(voiceFailureText("daily_limit")).toMatch(/limite/);
    expect(voiceFailureText("qualquer coisa")).toMatch(/Não consegui/);
  });
});
