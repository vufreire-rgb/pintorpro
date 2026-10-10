import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false, publishQuoteLink: vi.fn(), revokeQuoteLink: vi.fn(), listQuoteLinks: vi.fn(), fetchSharedQuote: vi.fn() }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn() }));

import { calculateQuote } from "@/engine";
import { DEFAULT_MATERIALS, DEFAULT_SERVICES } from "./catalog";
import { effectivePaymentLink, offersPix } from "./pdfData";
import { agoLabel, buildShareSnapshot, linkIsStale, linkMessage, viewedLabel, type QuoteLink } from "./quoteLinks";
import type { Db, EngineConfig, Quote, QuoteInput } from "./types";

const config: EngineConfig = { services: DEFAULT_SERVICES, materials: DEFAULT_MATERIALS, crew: { workers: 1, hourlyCostCents: 3125 }, hoursPerDay: 8, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price", marginPct: 30 };
const input: QuoteInput = { extras: [], rooms: [{ id: "r1", name: "Sala", lengthM: 5, widthM: 4, heightM: 2.5, openings: [], services: [{ serviceId: "pintura_parede" }] }] };
const q = { id: "q1", number: 42, clientId: "c1", siteAddress: "Rua A, 1", status: "open", createdAt: "2026-10-02T12:00:00Z", validUntil: "2026-10-09T12:00:00Z", paymentTerms: "50/50", notes: "", input, configSnapshot: config, engineVersion: "t", result: calculateQuote(input, config) } as unknown as Quote;
const db = { company: { name: "Silva Pinturas", whatsapp: "11999990000", city: "SP", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price", logoId: "logo1" }, clients: [{ id: "c1", name: "Maria Souza", phone: "", address: "" }], visits: [], quotes: [q], works: [] } as unknown as Db;

describe("buildShareSnapshot", () => {
  it("leva o que o cliente vê e nunca custo, lucro, margem, fotos ou logo", () => {
    const s = buildShareSnapshot(db, q);
    expect(s.painter.company).toBe("Silva Pinturas");
    expect(s.clientName).toBe("Maria Souza");
    expect(s.total).toMatch(/R\$/);
    expect(s.validUntil).toBe("2026-10-09T12:00:00Z");
    const json = JSON.stringify(s).toLowerCase();
    for (const w of ["custo", "lucro", "margem", "profit", "cost", "logo1", "photos"]) expect(json).not.toContain(w);
  });
});

describe("pagamento da entrada escolhido pelo pintor", () => {
  const withPay = (over: Record<string, unknown>, company: Record<string, unknown> = {}) =>
    ({ ...db, company: { ...db.company, pix: { type: "doc", key: "52998224725", name: "Silva" }, ...company }, quotes: [{ ...q, ...over }] }) as unknown as Db;
  const quote = (d: Db) => d.quotes[0]!;
  it("cartão: usa o link do orçamento e só aceita https", () => {
    expect(effectivePaymentLink({ paymentLink: "https://pagar.me/x" }, null)).toBe("https://pagar.me/x");
    expect(effectivePaymentLink({ paymentLink: "http://x.com" }, null)).toBeUndefined();
    expect(effectivePaymentLink({ paymentLink: "https://pagar.me/x", payCard: false }, null)).toBeUndefined();
  });
  it("cartão: usa o link padrão das configurações", () => {
    expect(effectivePaymentLink({}, { paymentLink: "https://pay.me/p" })).toBe("https://pay.me/p");
  });
  it("pix: ligado por padrão, desligável", () => {
    expect(offersPix({})).toBe(true);
    expect(offersPix({ payPix: false })).toBe(false);
  });
  it("o link só leva Pix e cartão quando o pintor deixou ligado", () => {
    const both = withPay({ paymentLink: "https://pay.me/p" });
    const s1 = buildShareSnapshot(both, quote(both));
    expect(s1.pix).not.toBeNull();
    expect(s1.deposit?.link).toBe("https://pay.me/p");
    const none = withPay({ paymentLink: "https://pay.me/p", payPix: false, payCard: false });
    const s2 = buildShareSnapshot(none, quote(none));
    expect(s2.pix).toBeNull();
    expect(s2.deposit).toBeNull();
    const cfg = withPay({}, { paymentLink: "https://pay.me/c" });
    expect(buildShareSnapshot(cfg, quote(cfg)).deposit?.link).toBe("https://pay.me/c");
  });
});

describe("textos do link", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  it("há quanto tempo", () => {
    expect(agoLabel("2026-10-07T11:59:50Z", now)).toBe("agora há pouco");
    expect(agoLabel("2026-10-07T11:30:00Z", now)).toBe("há 30 min");
    expect(agoLabel("2026-10-07T10:00:00Z", now)).toBe("há 2 h");
    expect(agoLabel("2026-10-04T12:00:00Z", now)).toBe("há 3 dias");
  });
  const link = (over: Partial<QuoteLink> = {}): QuoteLink => ({ token: "t", views: 0, firstViewedAt: null, lastViewedAt: null, updatedAt: "2026-10-07T10:00:00Z", ...over });
  it("situação do link", () => {
    expect(viewedLabel(undefined, now)).toBe("");
    expect(viewedLabel(link(), now)).toMatch(/ainda não abriu/);
    expect(viewedLabel(link({ views: 1, lastViewedAt: "2026-10-07T10:00:00Z" }), now)).toBe("O cliente abriu 1 vez. Última há 2 h.");
    expect(viewedLabel(link({ views: 3, lastViewedAt: "2026-10-07T11:55:00Z" }), now)).toBe("O cliente abriu 3 vezes. Última há 5 min.");
  });
  it("avisa quando o orçamento foi editado depois do link", () => {
    expect(linkIsStale({ revisedAt: "2026-10-07T11:00:00Z" }, link())).toBe(true);
    expect(linkIsStale({ revisedAt: "2026-10-07T09:00:00Z" }, link())).toBe(false);
    expect(linkIsStale({}, link())).toBe(false);
    expect(linkIsStale({ revisedAt: "2026-10-07T11:00:00Z" }, undefined)).toBe(false);
  });
  it("mensagem de WhatsApp", () => {
    expect(linkMessage("Maria Souza", "Silva Pinturas", "0042", "https://medde.com.br/o/abc")).toContain("Olá, Maria!");
    const m = linkMessage("Maria Souza", "Silva Pinturas", "0042", "https://medde.com.br/o/abc", "R$ 3.500,00").split("\n");
    expect(m.indexOf("https://medde.com.br/o/abc") + 1).toBe(m.indexOf("Valor total: R$ 3.500,00"));
  });
});
