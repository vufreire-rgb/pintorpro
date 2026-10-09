import { describe, expect, it } from "vitest";
import { daysWaiting, followUpMessage, needsFollowUp } from "./followUp";

const now = Date.parse("2026-10-10T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("lembrar o cliente", () => {
  it("conta os dias desde o orçamento (ou desde a revisão)", () => {
    expect(daysWaiting({ createdAt: ago(5) }, now)).toBe(5);
    expect(daysWaiting({ createdAt: ago(5), revisedAt: ago(1) }, now)).toBe(1);
    expect(daysWaiting({ createdAt: ago(0) }, now)).toBe(0);
  });
  it("só sugere para orçamento aberto há 3 dias ou mais", () => {
    expect(needsFollowUp({ status: "open", createdAt: ago(2) }, now)).toBe(false);
    expect(needsFollowUp({ status: "open", createdAt: ago(3) }, now)).toBe(true);
    expect(needsFollowUp({ status: "won", createdAt: ago(9) }, now)).toBe(false);
    expect(needsFollowUp({ status: "lost", createdAt: ago(9) }, now)).toBe(false);
  });
  it("mensagem usa só o primeiro nome", () => {
    expect(followUpMessage("Ana Souza", 7, "Silva Pinturas")).toContain("Oi Ana,");
    expect(followUpMessage("Ana Souza", 7, "Silva Pinturas")).toContain("orçamento nº 7");
  });
});
