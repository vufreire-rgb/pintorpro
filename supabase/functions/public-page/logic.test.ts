import { describe, expect, it } from "vitest";
import { isSlug, jpegDataUrl, MAX_PHOTOS, sanitizePage, sanitizeRequest, slugify } from "./logic";

describe("slug", () => {
  it("vira endereço sem acento nem símbolo", () => {
    expect(slugify("Silva Pinturas & Cia!")).toBe("silva-pinturas-cia");
    expect(slugify("João  Pintor — São Paulo")).toBe("joao-pintor-sao-paulo");
    expect(slugify("x".repeat(80)).length).toBeLessThanOrEqual(40);
  });
  it("só aceita endereços válidos e fora da lista reservada", () => {
    expect(isSlug("silva-pinturas")).toBe(true);
    for (const bad of ["a", "ab-", "-ab", "Silva", "silva pinturas", "a--b", "../x", "admin", "o", "pedidos", 5, null]) expect(isSlug(bad as never)).toBe(false);
  });
});
describe("sanitizePage", () => {
  it("exige o nome do negócio, limita listas e corrige a cor", () => {
    expect(sanitizePage({ company: "" })).toBeNull();
    const p = sanitizePage({ company: "Silva Pinturas", color: "azul", services: Array.from({ length: 40 }, (_, i) => `s${i}`), extra: "x" })!;
    expect(p.color).toBe("#0F3B7A");
    expect(p.services).toHaveLength(12);
    expect(JSON.stringify(p)).not.toContain("extra");
  });
});
describe("fotos da página", () => {
  const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  it("aceita só JPEG em data URL dentro do limite", () => {
    expect(jpegDataUrl(jpg, 1000)).toBe(jpg);
    expect(jpegDataUrl("data:image/png;base64,AAAA", 1000)).toBeUndefined();
    expect(jpegDataUrl("https://x.com/a.jpg", 1000)).toBeUndefined();
    expect(jpegDataUrl("data:image/jpeg;base64,<script>", 1000)).toBeUndefined();
    expect(jpegDataUrl(jpg, 10)).toBeUndefined();
  });
  it("limita a quantidade e descarta o que não for imagem válida", () => {
    const p = sanitizePage({ company: "Silva", avatar: jpg, photos: [jpg, "lixo", ...Array.from({ length: 20 }, () => jpg)] })!;
    expect(p.avatar).toBe(jpg);
    expect(p.photos).toHaveLength(MAX_PHOTOS);
    expect(sanitizePage({ company: "Silva", avatar: "javascript:alert(1)" })!.avatar).toBeUndefined();
  });
});
describe("sanitizeRequest", () => {
  it("aceita nome e telefone válidos", () => {
    expect(sanitizeRequest({ name: " Maria ", phone: "(11) 98888-7777", address: "Rua A", message: "Pintar a sala" })).toEqual({ name: "Maria", phone: "11988887777", address: "Rua A", message: "Pintar a sala" });
  });
  it("recusa nome curto e telefone inválido", () => {
    expect(sanitizeRequest({ name: "M", phone: "11988887777" })).toBeNull();
    expect(sanitizeRequest({ name: "Maria", phone: "123" })).toBeNull();
    expect(sanitizeRequest(null)).toBeNull();
  });
  it("campo escondido preenchido = robô", () => {
    expect(sanitizeRequest({ name: "Maria", phone: "11988887777", hp: "http://spam" })).toBe("spam");
  });
});
