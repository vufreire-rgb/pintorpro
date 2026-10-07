import { describe, expect, it } from "vitest";
import { accessMessage, accessOf, statusLine, type Subscription } from "./billing";

const at = (iso: string) => new Date(iso);
const trial = (end: string): Subscription => ({ status: "trial", trialEndsAt: end, periodEnd: null });
const paid = (end: string | null): Subscription => ({ status: "active", trialEndsAt: "2020-01-01T00:00:00Z", periodEnd: end });

describe("accessOf: teste de 30 dias", () => {
  const end = "2026-11-10T12:00:00Z";
  it("mais de 3 dias antes: tudo certo, sem aviso", () => {
    const a = accessOf(trial(end), at("2026-11-06T11:00:00Z")); // 4 dias e 1 h antes
    expect(a.level).toBe("ok");
    expect(accessMessage(a)).toBeNull();
  });
  it("até 3 dias antes: aviso de que o teste termina", () => {
    const a = accessOf(trial(end), at("2026-11-07T12:00:00Z")); // exatamente 3 dias
    expect(a.level).toBe("ending");
    expect(a.daysToEnd).toBe(3);
    expect(accessMessage(a)!.title).toBe("Seu teste grátis termina em 3 dias");
  });
  it("faltando menos de 1 dia", () => {
    const a = accessOf(trial(end), at("2026-11-10T06:00:00Z"));
    expect(a.level).toBe("ending");
    expect(accessMessage(a)!.title).toMatch(/hoje ou amanhã/);
  });
  it("depois de vencer, por 3 dias: aviso de bloqueio com contagem", () => {
    const a1 = accessOf(trial(end), at("2026-11-10T12:00:01Z"));
    expect(a1.level).toBe("grace");
    expect(a1.daysToBlock).toBe(3);
    expect(accessMessage(a1)!.text).toBe("O acesso será bloqueado em 3 dias. Seus dados continuam guardados.");
    const a2 = accessOf(trial(end), at("2026-11-12T00:00:00Z"));
    expect(a2.level).toBe("grace");
    expect(a2.daysToBlock).toBe(2);
    const a3 = accessOf(trial(end), at("2026-11-13T11:59:59Z"));
    expect(a3.level).toBe("grace");
    expect(a3.daysToBlock).toBe(1);
  });
  it("3 dias depois de vencer: bloqueado", () => {
    const a = accessOf(trial(end), at("2026-11-13T12:00:00Z"));
    expect(a.level).toBe("blocked");
    expect(accessMessage(a)!.title).toBe("Acesso bloqueado");
  });
});

describe("accessOf: assinatura paga", () => {
  it("sem data de fim: acesso liberado", () => {
    expect(accessOf(paid(null), at("2030-01-01T00:00:00Z")).level).toBe("ok");
  });
  it("usa o fim do período pago, não o do teste", () => {
    const a = accessOf(paid("2026-12-01T00:00:00Z"), at("2026-11-28T00:00:00Z"));
    expect(a.level).toBe("ending");
    expect(accessMessage(a)!.title).toBe("Sua assinatura vence em 3 dias");
  });
  it("pagamento atrasado: pendente e depois bloqueio", () => {
    const end = "2026-12-01T00:00:00Z";
    const g = accessOf(paid(end), at("2026-12-02T00:00:00Z"));
    expect(g.level).toBe("grace");
    expect(accessMessage(g)!.title).toBe("Pagamento pendente");
    expect(accessOf(paid(end), at("2026-12-05T00:00:00Z")).level).toBe("blocked");
  });
  it("cancelada vale até o fim do período e depois bloqueia", () => {
    const sub: Subscription = { status: "canceled", trialEndsAt: "2020-01-01T00:00:00Z", periodEnd: "2026-12-01T00:00:00Z" };
    expect(accessOf(sub, at("2026-11-01T00:00:00Z")).level).toBe("ok");
    expect(accessOf(sub, at("2026-12-10T00:00:00Z")).level).toBe("blocked");
  });
  it("data inválida não bloqueia ninguém", () => {
    expect(accessOf({ status: "trial", trialEndsAt: "lixo", periodEnd: null }).level).toBe("ok");
  });
});

describe("statusLine", () => {
  it("descreve o estado para a tela de Ajustes", () => {
    expect(statusLine(trial("2026-11-10T12:00:00Z"))).toMatch(/^Teste grátis até /);
    expect(statusLine(paid("2026-12-01T12:00:00Z"))).toMatch(/^Assinatura ativa até /);
    expect(statusLine(paid(null))).toBe("Assinatura ativa");
  });
});
