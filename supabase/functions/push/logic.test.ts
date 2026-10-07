import { describe, expect, it } from "vitest";
import { safeEqual, sanitizeMessage, sanitizeSubscription, shouldNotifyView, SIX_HOURS_MS } from "./logic";

const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };

describe("sanitizeSubscription", () => {
  it("aceita a inscrição do navegador", () => {
    expect(sanitizeSubscription(good)).toEqual({ endpoint: good.endpoint, p256dh: good.keys.p256dh, auth: good.keys.auth });
  });
  it("recusa http, lixo e chaves fora do formato", () => {
    expect(sanitizeSubscription({ ...good, endpoint: "http://x.com/a" })).toBeNull();
    expect(sanitizeSubscription({ ...good, endpoint: "javascript:alert(1)" })).toBeNull();
    expect(sanitizeSubscription({ endpoint: good.endpoint, keys: { p256dh: "<script>", auth: "x" } })).toBeNull();
    expect(sanitizeSubscription(null)).toBeNull();
    expect(sanitizeSubscription({ endpoint: good.endpoint })).toBeNull();
  });
});
describe("sanitizeMessage", () => {
  it("limita o texto e só deixa endereços dentro do app", () => {
    expect(sanitizeMessage({ title: "Oi", body: "x".repeat(500), url: "/orcamentos/abc" })).toMatchObject({ title: "Oi", url: "/orcamentos/abc" });
    expect(sanitizeMessage({ title: "Oi", body: "", url: "https://golpe.com" })!.url).toBe("/");
    expect(sanitizeMessage({ title: "Oi", body: "", url: "//golpe.com" })!.url).toBe("/");
    expect(sanitizeMessage({ title: "Oi", body: "x".repeat(500), url: "/" })!.body).toHaveLength(160);
    expect(sanitizeMessage({ title: "", body: "x" })).toBeNull();
  });
});
describe("safeEqual", () => {
  it("compara chaves", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});
describe("shouldNotifyView", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  it("avisa na primeira abertura e depois só após 6 horas", () => {
    expect(shouldNotifyView(0, null, now)).toBe(true);
    expect(shouldNotifyView(3, new Date(now - 60_000).toISOString(), now)).toBe(false);
    expect(shouldNotifyView(3, new Date(now - SIX_HOURS_MS - 1).toISOString(), now)).toBe(true);
  });
});
