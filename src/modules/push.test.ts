import { describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false, fetchPushKey: vi.fn(), savePushSubscription: vi.fn(), removePushSubscription: vi.fn(), sendPushTest: vi.fn() }));

import { PUSH_TEXT, shouldAskPush, urlBase64ToUint8Array } from "./push";

describe("urlBase64ToUint8Array", () => {
  it("converte a chave pública do servidor para bytes (65 bytes, começa com 4)", () => {
    const key = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
  it("trata os caracteres - e _ do base64url", () => {
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});

describe("textos", () => {
  it("há um texto em português para cada estado", () => {
    for (const k of ["unsupported", "needs-install", "denied", "off", "on"] as const) expect(PUSH_TEXT[k].length).toBeGreaterThan(5);
    expect(PUSH_TEXT["needs-install"]).toMatch(/iPhone/);
  });
});

describe("convite único para ligar os avisos", () => {
  it("só pergunta quando está desligado e nunca foi perguntado", () => {
    expect(shouldAskPush("off", {})).toBe(true);
    expect(shouldAskPush("off", null)).toBe(true);
    expect(shouldAskPush("off", { pushAsked: true })).toBe(false);
    expect(shouldAskPush("on", {})).toBe(false);
    expect(shouldAskPush("denied", {})).toBe(false);
    expect(shouldAskPush("unsupported", {})).toBe(false);
    expect(shouldAskPush("needs-install", {})).toBe(false);
    expect(shouldAskPush("loading", {})).toBe(false);
  });
});
