import { describe, expect, it } from "vitest";
import { brDay, buildStats, DEFAULT_SETTINGS, delta, periodsFor, sanitizeExpense, sanitizeSettings, type Inputs } from "./logic";

const now = new Date("2026-10-15T15:00:00Z"); // 12h em Brasília
const DAY = 86400000;
const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
const q = (over: Record<string, unknown>) => ({ status: "open", createdAt: ago(1), result: { totals: { totalCents: 100000 } }, ...over });

const base = (): Inputs => ({
  now,
  users: [
    { id: "a", email: "a@x.com", created_at: ago(40), last_sign_in_at: ago(1) },
    { id: "b", email: "b@x.com", created_at: ago(20), last_sign_in_at: ago(12) },
    { id: "c", email: "c@x.com", created_at: ago(2), last_sign_in_at: ago(2) },
    { id: "d", email: "d@x.com", created_at: ago(30), last_sign_in_at: null },
  ],
  subs: [
    { user_id: "a", status: "active", trial_ends_at: ago(10), current_period_end: new Date(now.getTime() + 10 * DAY).toISOString() },
    { user_id: "b", status: "trial", trial_ends_at: ago(-2), current_period_end: null },
    { user_id: "c", status: "trial", trial_ends_at: ago(5), current_period_end: null },
    { user_id: "d", status: "canceled", trial_ends_at: ago(0), current_period_end: null },
  ],
  docs: [
    { user_id: "a", updated_at: ago(1), company: { name: "Silva Pinturas", whatsapp: "11999990000" }, visits: [{}, { isExample: true }], quotes: [q({ status: "won", closedAt: ago(1) }), q({ createdAt: ago(10) }), q({ isExample: true })] },
    { user_id: "b", updated_at: ago(12), company: { name: "Beto" }, visits: [], quotes: [] },
  ],
  voice: [{ user_id: "a", day: brDay(ago(1)), count: 3 }, { user_id: "a", day: brDay(ago(10)), count: 5 }],
  receipts: [{ user_id: "a", day: brDay(ago(1)), count: 2 }],
  shared: [{ user_id: "a", views_count: 2 }],
  settings: DEFAULT_SETTINGS,
});

describe("períodos", () => {
  it("7 dias: hoje e os 6 anteriores, contra os 7 antes", () => {
    const p = periodsFor("7d", now);
    expect(p.cur).toEqual(["2026-10-09", "2026-10-15"]);
    expect(p.prev).toEqual(["2026-10-02", "2026-10-08"]);
  });
  it("mês: do dia 1 até hoje contra o mês anterior até o mesmo dia", () => {
    const p = periodsFor("mes", now);
    expect(p.cur).toEqual(["2026-10-01", "2026-10-15"]);
    expect(p.prev).toEqual(["2026-09-01", "2026-09-15"]);
  });
  it("mês em janeiro compara com dezembro e respeita meses curtos", () => {
    expect(periodsFor("mes", new Date("2026-01-20T12:00:00Z")).prev).toEqual(["2025-12-01", "2025-12-20"]);
    expect(periodsFor("mes", new Date("2026-03-31T12:00:00Z")).prev).toEqual(["2026-02-01", "2026-02-28"]);
  });
  it("virada do dia usa o horário de Brasília", () => {
    expect(brDay("2026-10-15T02:30:00Z")).toBe("2026-10-14");
  });
});

describe("delta", () => {
  it("formata variação", () => {
    expect(delta(112, 100)).toBe("+12%");
    expect(delta(90, 100)).toBe("−10%");
    expect(delta(5, 5)).toBe("igual");
    expect(delta(5, 0)).toBeNull();
    expect(delta(8, 3, "abs")).toBe("+5");
  });
});

describe("buildStats", () => {
  const s = buildStats(base(), "7d");
  it("conta assinantes por situação", () => {
    expect(s.assinantes).toMatchObject({ pagantes: 1, emTeste: 1, testeVencido: 1, cancelados: 1, atrasados: 0 });
  });
  it("assinatura paga com período vencido vira atrasada", () => {
    const i = base(); i.subs[0]!.current_period_end = ago(2);
    expect(buildStats(i, "7d").assinantes).toMatchObject({ pagantes: 0, atrasados: 1 });
  });
  it("ignora dados de exemplo nos orçamentos", () => {
    expect(s.atual.orcamentos).toBe(2 - 1); // só o criado ontem e fechado; o de 10 dias está fora dos 7; o exemplo não conta
    expect(s.funil.primeiraVisita).toBe(1);
    expect(s.funil.primeiroOrcamento).toBe(1);
  });
  it("valor e taxa de fechamento", () => {
    expect(s.atual.valorOrcadoCents).toBe(100000);
    expect(s.atual.fechados).toBe(1);
    expect(s.atual.valorFechadoCents).toBe(100000);
    expect(s.atual.taxaFechamentoPct).toBe(100);
  });
  it("custo de IA = voz × custo + recibos × custo", () => {
    expect(s.atual.voz).toBe(3);
    expect(s.atual.recibos).toBe(2);
    expect(s.atual.custoIaCents).toBe(3 * 10 + 2 * 2);
  });
  it("lista contas sumidas com contato e quem está perto do fim do teste", () => {
    expect(s.sumidas.map((c) => c.id)).toEqual(["b", "d"]);
    expect(s.sumidas[1]).toMatchObject({ name: "(sem nome)", email: "d@x.com", phone: "" });
    expect(s.fimDoTeste.map((c) => c.id)).toEqual(["b"]);
    const i = base(); i.subs[1]!.trial_ends_at = new Date(now.getTime() + 10 * DAY).toISOString();
    expect(buildStats(i, "7d").fimDoTeste).toEqual([]);
  });
  it("ativas na semana e funil de envio e fechamento", () => {
    expect(s.ativas7d).toBe(2);
    expect(s.funil.orcamentoEnviado).toBe(1);
    expect(s.funil.orcamentoFechado).toBe(1);
  });
  it("faturamento fica desligado e a meta mostra quanto falta", () => {
    expect(s.dinheiro.ligado).toBe(false);
    expect(s.dinheiro.faturamentoCents).toBeNull();
    expect(s.meta).toMatchObject({ alvo: 100, atual: 1, faltam: 99 });
  });
  it("série de contas novas tem um valor por dia", () => {
    expect(s.serieNovasContas).toHaveLength(7);
    expect(s.serieNovasContas.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("sanitizeSettings", () => {
  it("troca só o que é número válido", () => {
    const r = sanitizeSettings({ goalSubscribers: 250, taxPct: -3, fixedCostCents: 14000.4, goalDate: "2026-12-31", x: 1 }, DEFAULT_SETTINGS);
    expect(r).toMatchObject({ goalSubscribers: 250, taxPct: 6, fixedCostCents: 14000, goalDate: "2026-12-31" });
    expect(Object.keys(r)).not.toContain("x");
  });
});

describe("gastos do app", () => {
  it("soma só os gastos do período e lista do mais novo ao mais antigo", () => {
    const i = base();
    const today = brDay(i.now);
    i.expenses = [{ id: "a", day: "2000-01-01", description: "velho", amountCents: 500 }, { id: "b", day: today, description: "domínio", amountCents: 4000 }];
    const s = buildStats(i, "7d");
    expect(s.dinheiro.gastosCents).toBe(4000);
    expect(s.gastos.map((g) => g.id)).toEqual(["b", "a"]);
  });
  it("sanitizeExpense recusa vazio/zero e usa hoje sem data", () => {
    expect(sanitizeExpense({ description: " ", amountCents: 100 }, "2026-01-01")).toBeNull();
    expect(sanitizeExpense({ description: "x", amountCents: 0 }, "2026-01-01")).toBeNull();
    expect(sanitizeExpense({ description: " Vercel ", amountCents: 2000.4, day: "" }, "2026-01-01")).toEqual({ day: "2026-01-01", description: "Vercel", amountCents: 2000 });
  });
});
