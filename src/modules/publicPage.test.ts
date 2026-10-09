import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false, deleteRequestRow: vi.fn(), disablePublicPage: vi.fn(), fetchPublicPage: vi.fn(), getMyPage: vi.fn(), listRequests: vi.fn(), publishPublicPage: vi.fn(), setRequestStatus: vi.fn(), submitPublicRequest: vi.fn() }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn() }));

import { newDb } from "./db";
import { buildPageSnapshot, isValidSlug, pageErrorText, pageUrl, phoneLabel, requestWhatsApp, slugify, visitFromRequest } from "./publicPage";
import type { Db } from "./types";

const read = (): Db => JSON.parse(store.get("pintorpro:v1")!) as Db;
const setup = (): Db => {
  const db = newDb();
  db.company = { name: "Silva Pinturas", whatsapp: "11999990000", city: "São Paulo, SP", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price", brandColor: "#B3261E" };
  store.set("pintorpro:v1", JSON.stringify(db));
  return db;
};
beforeEach(() => store.clear());

describe("endereço da página", () => {
  it("slugify e validação (iguais às do servidor)", () => {
    expect(slugify("Silva Pinturas & Cia!")).toBe("silva-pinturas-cia");
    expect(isValidSlug("silva-pinturas")).toBe(true);
    for (const bad of ["a", "Silva", "a--b", "admin", "p", "-ab"]) expect(isValidSlug(bad)).toBe(false);
  });
  it("mensagens de erro em português", () => {
    expect(pageErrorText("slug_taken")).toMatch(/já está em uso/);
    expect(pageErrorText("???")).toMatch(/Não consegui/);
  });
});

describe("buildPageSnapshot", () => {
  it("leva só o que o cliente pode ver", () => {
    const db = setup();
    const s = buildPageSnapshot(db, { slug: "silva", headline: " Pintura com capricho ", about: "10 anos", photos: [] });
    expect(s).toMatchObject({ company: "Silva Pinturas", city: "São Paulo, SP", whatsapp: "11999990000", color: "#B3261E", headline: "Pintura com capricho", initials: "SP" });
    expect(s.services).toEqual([]);
    expect(s.avatar).toBeUndefined();
    const jpg = "data:image/jpeg;base64,/9j/AAAA";
    const c = buildPageSnapshot(db, { slug: "silva", headline: "", about: "", avatar: jpg, photos: Array.from({ length: 9 }, () => jpg) });
    expect(c.avatar).toBe(jpg);
    expect(c.photos).toHaveLength(6);
    expect(JSON.stringify(s).toLowerCase()).not.toMatch(/pix|dailyrate|margin|custo/);
  });
});

describe("pedido recebido", () => {
  it("telefone e WhatsApp", () => {
    expect(phoneLabel("11988887777")).toBe("(11) 98888-7777");
    expect(phoneLabel("1133334444")).toBe("(11) 3333-4444");
    expect(requestWhatsApp({ name: "Maria Souza", phone: "11988887777" }, "Silva Pinturas")).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
  });
  it("criar visita cria o cliente e a visita com o que o cliente escreveu", () => {
    const db = setup();
    const id = visitFromRequest(db, { name: "Maria Souza", phone: "11988887777", address: "Rua A, 10", message: "Pintar a sala" });
    const saved = read();
    expect(saved.clients).toHaveLength(1);
    expect(saved.clients[0]).toMatchObject({ name: "Maria Souza", phone: "(11) 98888-7777", address: "Rua A, 10" });
    expect(saved.visits[0]).toMatchObject({ id, clientId: saved.clients[0]!.id, siteAddress: "Rua A, 10", notes: "Pedido do cliente: Pintar a sala" });
    expect(saved.visits[0]!.startedAt).toBeTruthy();
  });
  it("não duplica o cliente se ele já existe", () => {
    const db = setup();
    visitFromRequest(db, { name: "Maria Souza", phone: "11988887777", address: "Rua A", message: "" });
    visitFromRequest(read(), { name: "maria souza", phone: "(11) 98888-7777", address: "Rua B", message: "" });
    expect(read().clients).toHaveLength(1);
    expect(read().visits).toHaveLength(2);
  });
});

describe("pageUrl", () => {
  it("usa o endereço oficial curto do Medde", () => {
    expect(pageUrl("silva-pinturas")).toBe("https://medde.com.br/p/silva-pinturas");
  });
});
