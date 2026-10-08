// Regras do painel do administrador (sem rede e sem banco: testável). Tudo em dias do horário de Brasília (UTC-3).

export interface AuthUser { id: string; email: string; created_at: string; last_sign_in_at?: string | null }
export interface Sub { user_id: string; status: string; trial_ends_at: string; current_period_end: string | null }
export interface Doc { user_id: string; updated_at: string; company: { name?: string; whatsapp?: string } | null; visits: unknown[] | null; quotes: unknown[] | null }
export interface Usage { user_id: string; day: string; count: number }
export interface Shared { user_id: string; views_count: number }
export interface Settings { goalSubscribers: number; goalDate: string | null; taxPct: number; fixedCostCents: number; voiceCostCents: number; receiptCostCents: number }

export const DEFAULT_SETTINGS: Settings = { goalSubscribers: 100, goalDate: null, taxPct: 6, fixedCostCents: 0, voiceCostCents: 10, receiptCostCents: 2 };
const HOUR = 3600_000, DAY = 24 * HOUR;

/** Dia (AAAA-MM-DD) no horário de Brasília. */
export const brDay = (d: Date | string | number): string => new Date(new Date(d).getTime() - 3 * HOUR).toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => new Date(Date.parse(day + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export type Range = [string, string];
export interface Periods { cur: Range; prev: Range; days: number }

/** "7d" = últimos 7 dias × os 7 antes; "mes" = mês até hoje × mês anterior até o mesmo dia. */
export function periodsFor(kind: "7d" | "mes", now: Date): Periods {
  const today = brDay(now);
  if (kind === "7d") return { cur: [addDays(today, -6), today], prev: [addDays(today, -13), addDays(today, -7)], days: 7 };
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), d = Number(today.slice(8, 10));
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const pfirst = `${py}-${String(pm).padStart(2, "0")}-01`;
  const pend = `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, daysInMonth(py, pm))).padStart(2, "0")}`;
  return { cur: [`${today.slice(0, 7)}-01`, today], prev: [pfirst, pend], days: d };
}
const inR = (day: string, r: Range): boolean => day >= r[0] && day <= r[1];

/** Variação para mostrar ao lado do número: "+12%", "−5%", "igual" ou null quando não há base de comparação. */
export function delta(cur: number, prev: number, unit: "pct" | "abs" = "pct"): string | null {
  if (unit === "abs") { const d = cur - prev; return d === 0 ? "igual" : `${d > 0 ? "+" : "−"}${Math.abs(d)}`; }
  if (prev === 0) return cur === 0 ? "igual" : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? "igual" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`;
}

const notExample = (x: unknown): boolean => !(x && typeof x === "object" && (x as { isExample?: boolean }).isExample);
interface Q { status?: string; createdAt?: string; closedAt?: string; result?: { totals?: { totalCents?: number } } }
const quoteCents = (q: Q): number => (typeof q.result?.totals?.totalCents === "number" ? q.result.totals.totalCents : 0);

export interface Contact { id: string; name: string; email: string; phone: string; daysSince: number; quotes: number }

export interface PeriodStats {
  novasContas: number; orcamentos: number; valorOrcadoCents: number; fechados: number; valorFechadoCents: number;
  taxaFechamentoPct: number | null; voz: number; recibos: number; custoIaCents: number;
}

export function periodStats(i: Inputs, r: Range): PeriodStats {
  const quotes = i.docs.flatMap((d) => ((d.quotes ?? []) as Q[]).filter(notExample));
  const made = quotes.filter((q) => q.createdAt && inR(brDay(q.createdAt), r));
  const won = quotes.filter((q) => q.status === "won" && q.closedAt && inR(brDay(q.closedAt), r));
  const madeWon = made.filter((q) => q.status === "won").length;
  const sum = (u: Usage[]) => u.filter((x) => inR(x.day, r)).reduce((n, x) => n + x.count, 0);
  const voz = sum(i.voice), recibos = sum(i.receipts);
  return {
    novasContas: i.users.filter((u) => inR(brDay(u.created_at), r)).length,
    orcamentos: made.length,
    valorOrcadoCents: made.reduce((n, q) => n + quoteCents(q), 0),
    fechados: won.length,
    valorFechadoCents: won.reduce((n, q) => n + quoteCents(q), 0),
    taxaFechamentoPct: made.length ? Math.round((madeWon / made.length) * 100) : null,
    voz, recibos,
    custoIaCents: voz * i.settings.voiceCostCents + recibos * i.settings.receiptCostCents,
  };
}

export interface Inputs { now: Date; users: AuthUser[]; subs: Sub[]; docs: Doc[]; voice: Usage[]; receipts: Usage[]; shared: Shared[]; settings: Settings }

export function buildStats(i: Inputs, kind: "7d" | "mes") {
  const P = periodsFor(kind, i.now);
  const cur = periodStats(i, P.cur), prev = periodStats(i, P.prev);
  const nowMs = i.now.getTime();
  const subOf = new Map(i.subs.map((s) => [s.user_id, s]));
  const docOf = new Map(i.docs.map((d) => [d.user_id, d]));

  let pagantes = 0, emTeste = 0, testeVencido = 0, atrasados = 0, cancelados = 0;
  for (const u of i.users) {
    const s = subOf.get(u.id);
    if (!s) continue;
    if (s.status === "canceled") cancelados++;
    else if (s.status === "active") { if (s.current_period_end && Date.parse(s.current_period_end) < nowMs) atrasados++; else pagantes++; }
    else if (Date.parse(s.trial_ends_at) > nowMs) emTeste++;
    else testeVencido++;
  }

  const contact = (u: AuthUser, since: number): Contact => {
    const doc = docOf.get(u.id);
    return { id: u.id, name: doc?.company?.name?.trim() || "(sem nome)", email: u.email, phone: doc?.company?.whatsapp?.trim() || "", daysSince: since, quotes: ((doc?.quotes ?? []) as unknown[]).filter(notExample).length };
  };
  const lastSeen = (u: AuthUser): number => Math.max(Date.parse(u.last_sign_in_at ?? u.created_at), Date.parse(docOf.get(u.id)?.updated_at ?? u.created_at), Date.parse(u.created_at));
  const ativas7d = i.users.filter((u) => nowMs - lastSeen(u) < 7 * DAY).length;
  const sumidas = i.users
    .filter((u) => nowMs - Date.parse(u.created_at) >= 7 * DAY && nowMs - lastSeen(u) >= 7 * DAY)
    .sort((a, b) => lastSeen(b) - lastSeen(a))
    .slice(0, 100)
    .map((u) => contact(u, Math.floor((nowMs - lastSeen(u)) / DAY)));
  const fimDoTeste = i.users
    .filter((u) => { const s = subOf.get(u.id); if (!s || s.status !== "trial") return false; const left = Date.parse(s.trial_ends_at) - nowMs; return left > 0 && left <= 3 * DAY; })
    .map((u) => contact(u, Math.max(0, Math.ceil((Date.parse(subOf.get(u.id)!.trial_ends_at) - nowMs) / DAY))));

  const sharedUsers = new Set(i.shared.filter((s) => s.views_count >= 0).map((s) => s.user_id));
  const has = (pick: (d: Doc) => boolean) => i.docs.filter(pick).length;
  const funil = {
    contas: i.users.length,
    primeiraVisita: has((d) => ((d.visits ?? []) as unknown[]).some(notExample)),
    primeiroOrcamento: has((d) => ((d.quotes ?? []) as unknown[]).some(notExample)),
    orcamentoEnviado: i.docs.filter((d) => sharedUsers.has(d.user_id)).length,
    orcamentoFechado: has((d) => ((d.quotes ?? []) as Q[]).some((q) => notExample(q) && q.status === "won")),
  };

  const serieDias = kind === "7d" ? 7 : P.days;
  const today = brDay(i.now);
  const serie = Array.from({ length: serieDias }, (_, k) => { const day = addDays(today, -(serieDias - 1 - k)); return i.users.filter((u) => brDay(u.created_at) === day).length; });

  const s = i.settings;
  const fixos = Math.round(s.fixedCostCents * (P.days / 30));
  const faturamento = null as number | null; // liga quando o pagamento existir
  return {
    periodo: kind, intervalo: P,
    meta: { alvo: s.goalSubscribers, data: s.goalDate, atual: pagantes, faltam: Math.max(0, s.goalSubscribers - pagantes), ritmoPorSemana: null as number | null },
    assinantes: { pagantes, emTeste, testeVencido, atrasados, cancelados, deltaEmTeste: delta(cur.novasContas, prev.novasContas, "abs") },
    atual: cur, anterior: prev,
    deltas: { orcamentos: delta(cur.orcamentos, prev.orcamentos), novasContas: delta(cur.novasContas, prev.novasContas), valorOrcado: delta(cur.valorOrcadoCents, prev.valorOrcadoCents), taxaFechamento: cur.taxaFechamentoPct !== null && prev.taxaFechamentoPct !== null ? delta(cur.taxaFechamentoPct, prev.taxaFechamentoPct, "abs") : null, custoIa: delta(cur.custoIaCents, prev.custoIaCents) },
    ativas7d, sumidas, fimDoTeste, funil, serieNovasContas: serie,
    dinheiro: { ligado: false, faturamentoCents: faturamento, impostoCents: null as number | null, custoIaCents: cur.custoIaCents, fixosCents: fixos, lucroCents: null as number | null },
    ajustes: s,
  };
}

/** Aceita só números válidos nos ajustes; o resto fica como estava. */
export function sanitizeSettings(raw: unknown, base: Settings): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, fb: number): number => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fb);
  const date = typeof r.goalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.goalDate) ? r.goalDate : r.goalDate === null ? null : base.goalDate;
  return {
    goalSubscribers: Math.round(num(r.goalSubscribers, 1, 1_000_000, base.goalSubscribers)),
    goalDate: date,
    taxPct: num(r.taxPct, 0, 100, base.taxPct),
    fixedCostCents: Math.round(num(r.fixedCostCents, 0, 100_000_000, base.fixedCostCents)),
    voiceCostCents: Math.round(num(r.voiceCostCents, 0, 10_000, base.voiceCostCents)),
    receiptCostCents: Math.round(num(r.receiptCostCents, 0, 10_000, base.receiptCostCents)),
  };
}
