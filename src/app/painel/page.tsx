"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Check, Clock, MessageCircle, Plus, Sparkles, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { BlocoRecolhivel, Button, Card, Field, Loading, NumberInput, Screen, TAB_LIST_CLS, tabCls, TextInput } from "@/components/ui";
import { cloudEnabled } from "@/modules/auth";
import { deltaTone, loadAdminStats, whatsappDigits, type AdminContact, type AdminSettings, type AdminStats } from "@/modules/adminPanel";
import { formatBRL } from "@/shared/money";

const TONE = { up: "bg-[#E3F4EA] text-[#07602F]", down: "bg-[#FDE8E8] text-[#C0262D]", flat: "bg-brand-soft text-brand" };

function Delta({ text, goodWhenUp = true }: { text: string | null; goodWhenUp?: boolean }) {
  if (!text) return null;
  return <span className={`w-fit rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${TONE[deltaTone(text, goodWhenUp)]}`}>{text}</span>;
}

function Tile({ label, value, delta, goodWhenUp = true }: { label: string; value: string; delta?: string | null; goodWhenUp?: boolean }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1">
      <span className="text-base leading-[22px] text-support">{label}</span>
      <span className="font-display text-[28px] font-semibold leading-8 tabular-nums">{value}</span>
      <Delta text={delta ?? null} goodWhenUp={goodWhenUp} />
    </Card>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 300, h = 56, max = Math.max(1, ...values), n = values.length;
  const pts = values.map((v, i) => [n > 1 ? (i / (n - 1)) * (w - 8) + 4 : w / 2, h - 6 - (v / max) * (h - 14)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[n - 1] ?? [0, h];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 block h-14 w-full" role="img" aria-label="Contas novas por dia">
      <path d={`${line} L${last[0]} ${h} L${pts[0]?.[0] ?? 0} ${h} Z`} fill="#E8EFFA" />
      <path d={line} fill="none" stroke="#0F3B7A" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="#0F3B7A" />
    </svg>
  );
}

function ContactRow({ c, kind }: { c: AdminContact; kind: "sumida" | "teste" }) {
  const wa = whatsappDigits(c.phone);
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#F3F6FA] p-3">
      <div className="flex items-start justify-between gap-2">
        <b className="min-w-0 break-words text-lg">{c.name}</b>
        <span className="shrink-0 text-base text-support">{kind === "sumida" ? `${c.daysSince} dias sem usar` : c.daysSince <= 1 ? "termina hoje ou amanhã" : `termina em ${c.daysSince} dias`}</span>
      </div>
      <div className="break-all text-base text-support">{c.email}</div>
      <div className="text-base">{c.phone || "Sem WhatsApp cadastrado"} · {c.quotes} {c.quotes === 1 ? "orçamento" : "orçamentos"}</div>
      {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-3xl bg-brand-soft px-4 font-display text-[17px] font-semibold text-brand"><MessageCircle size={20} strokeWidth={2.2} aria-hidden />Chamar no WhatsApp</a> : null}
    </div>
  );
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export default function Painel() {
  const [period, setPeriod] = useState<"7d" | "mes">("7d");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<"forbidden" | "failed" | null>(null);
  const [why, setWhy] = useState("");
  const [form, setForm] = useState<{ goal: number; date: string; tax: number; fixed: number; voice: number; receipt: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState<{ desc: string; value: number; day: string }>({ desc: "", value: 0, day: "" });

  const apply = (s: AdminStats) => {
    setStats(s);
    setForm((f) => f ?? { goal: s.ajustes.goalSubscribers, date: s.ajustes.goalDate ?? "", tax: s.ajustes.taxPct, fixed: s.ajustes.fixedCostCents / 100, voice: s.ajustes.voiceCostCents / 100, receipt: s.ajustes.receiptCostCents / 100 });
  };
  const load = useCallback(async (p: "7d" | "mes") => {
    setErr(null);
    try { apply(await loadAdminStats(p)); } catch (e) { const m = e instanceof Error ? e.message : ""; setWhy(m); setErr(m.startsWith("forbidden") ? "forbidden" : "failed"); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cloudEnabled) void load(period);
  }, [period, load]);

  if (!cloudEnabled) return <Screen title="Painel"><Card>O painel precisa da conta na nuvem do Medde.</Card></Screen>;
  if (err === "forbidden") return <Screen title="Painel"><Card className="flex flex-col gap-3"><b>Sem acesso</b><p className="text-support">Este painel é só do administrador do Medde.</p><Link href="/visitas" className="font-display font-semibold text-live">Voltar ao app</Link></Card></Screen>;
  if (err === "failed") return <Screen title="Painel"><Card className="flex flex-col gap-3"><p>Não consegui carregar os números agora. Verifique a internet.</p>{why ? <p className="break-words text-base text-support">Motivo: {why}</p> : null}<Button onClick={() => void load(period)}>Tentar de novo</Button></Card></Screen>;
  if (!stats || !form) return <Loading />;

  const { meta, assinantes: a, atual: c, deltas: d, dinheiro: m, funil: f } = stats;
  const metaPct = Math.min(100, Math.round((meta.atual / Math.max(1, meta.alvo)) * 100));
  const settings = (): AdminSettings => ({ goalSubscribers: Math.max(1, Math.round(form.goal)), goalDate: form.date || null, taxPct: form.tax, fixedCostCents: Math.round(form.fixed * 100), voiceCostCents: Math.round(form.voice * 100), receiptCostCents: Math.round(form.receipt * 100) });
  const save = async () => {
    setBusy(true); setSaved(false);
    try { apply(await loadAdminStats(period, settings())); setSaved(true); } catch (e) { setWhy(e instanceof Error ? e.message : ""); setErr("failed"); } finally { setBusy(false); }
  };

  const expense = async (extra: { addExpense?: { description: string; amountCents: number; day: string }; deleteExpense?: string }) => {
    setBusy(true);
    try { apply(await loadAdminStats(period, undefined, extra)); if (extra.addExpense) setExp({ desc: "", value: 0, day: "" }); } catch (e) { setWhy(e instanceof Error ? e.message : ""); setErr("failed"); } finally { setBusy(false); }
  };
  return (
    <Screen title="Painel Medde" corner={<Link href="/visitas" className="inline-flex min-h-12 items-center font-display text-lg font-semibold text-live">Ir ao app</Link>}>
      <div role="tablist" className={`${TAB_LIST_CLS} grid-cols-2`}>
        <button role="tab" aria-selected={period === "7d"} className={tabCls(period === "7d")} onClick={() => setPeriod("7d")}>7 dias</button>
        <button role="tab" aria-selected={period === "mes"} className={tabCls(period === "mes")} onClick={() => setPeriod("mes")}>Mês</button>
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-2"><span className="text-base text-support">Meta de assinantes</span><span className="text-base text-support">{meta.data ? `até ${meta.data.split("-").reverse().join("/")}` : "sem data"}</span></div>
        <div className="flex items-baseline justify-between gap-2"><span className="font-display text-[40px] font-semibold leading-[44px] tabular-nums">{meta.atual}</span><span className="text-base text-support">de <b>{meta.alvo}</b></span></div>
        <div className="my-2 h-3 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metaPct}><div className="h-full rounded-full bg-accent-dark" style={{ width: `${metaPct}%` }} /></div>
        <div className="text-base text-support">Faltam {meta.faltam}.{meta.ritmoPorSemana === null ? " O ritmo aparece depois das primeiras assinaturas." : ""}</div>
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
        <Tile label="Assinantes pagando" value={String(a.pagantes)} />
        <Tile label="Em teste grátis" value={String(a.emTeste)} delta={a.deltaEmTeste} />
        <Tile label="Orçamentos gerados" value={c.orcamentos.toLocaleString("pt-BR")} delta={d.orcamentos} />
        <Tile label="Taxa de fechamento" value={c.taxaFechamentoPct === null ? "—" : `${c.taxaFechamentoPct}%`} delta={d.taxaFechamento} />
      </div>
      <Card className="flex flex-col">
        <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-base text-support">Valor orçado</span><span className="flex flex-wrap items-baseline justify-end gap-2"><Delta text={d.valorOrcado} /><b className="font-display text-2xl font-semibold tabular-nums">{formatBRL(c.valorOrcadoCents)}</b></span></div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line py-2"><span className="text-base text-support">Valor fechado</span><b className="font-display text-2xl font-semibold tabular-nums">{formatBRL(c.valorFechadoCents)}</b></div>
      </Card>
      {a.testeVencido + a.atrasados + a.cancelados > 0 ? <p className="text-base text-support">Também: {a.testeVencido} com teste vencido, {a.atrasados} atrasados e {a.cancelados} cancelados.</p> : null}

      <Card>
        <div className="flex items-center justify-between gap-2"><span className="text-base text-support">Contas novas por dia · {c.novasContas} no período</span><Delta text={d.novasContas} /></div>
        <Spark values={stats.serieNovasContas} />
      </Card>

      <BlocoRecolhivel title="Contas sumidas" icon={TriangleAlert} summary={`${stats.sumidas.length} sem usar há 7 dias ou mais`} badge={{ text: String(stats.sumidas.length), ok: stats.sumidas.length === 0 }}>
        {stats.sumidas.length === 0 ? <p className="text-base text-support">Nenhuma conta sumida.</p> : stats.sumidas.map((x) => <ContactRow key={x.id} c={x} kind="sumida" />)}
      </BlocoRecolhivel>
      <BlocoRecolhivel title="Teste acabando" icon={Clock} summary={`${stats.fimDoTeste.length} nos próximos 3 dias`} badge={{ text: String(stats.fimDoTeste.length), ok: stats.fimDoTeste.length === 0 }}>
        {stats.fimDoTeste.length === 0 ? <p className="text-base text-support">Ninguém com o teste acabando nos próximos 3 dias.</p> : stats.fimDoTeste.map((x) => <ContactRow key={x.id} c={x} kind="teste" />)}
      </BlocoRecolhivel>

      <BlocoRecolhivel title="Funil de uso" icon={BarChart3} summary={`${stats.ativas7d} contas ativas na semana`}>
        {([["Cadastraram", f.contas], ["Fizeram a primeira visita", f.primeiraVisita], ["Fizeram o primeiro orçamento", f.primeiroOrcamento], ["Enviaram um orçamento pelo link", f.orcamentoEnviado], ["Fecharam um orçamento", f.orcamentoFechado]] as const).map(([t, n]) => (
          <div key={t} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-base"><span>{t}</span><b className="tabular-nums">{n} · {pct(n, f.contas)}</b></div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-soft"><div className="h-full rounded-full bg-brand" style={{ width: pct(n, f.contas) === "—" ? "0%" : pct(n, f.contas) }} /></div>
          </div>
        ))}
      </BlocoRecolhivel>

      <h2 className="px-1 font-display text-xl font-medium">Dinheiro</h2>
      <Card className="flex flex-col gap-1">
        {m.ligado ? null : <div className="mb-2 flex items-start gap-2 rounded-2xl bg-[#FFF3D6] p-3 text-[#8A4B00]"><Wallet size={22} aria-hidden className="mt-0.5 shrink-0" />Faturamento aparece aqui depois que o pagamento estiver ligado.</div>}
        {([["Faturamento", m.faturamentoCents === null ? "—" : formatBRL(m.faturamentoCents)], ["Imposto", m.impostoCents === null ? "—" : formatBRL(m.impostoCents)], ["Custo de IA (voz e recibo)", formatBRL(m.custoIaCents)], ["Custos fixos do período", formatBRL(m.fixosCents)], ["Gastos lançados no período", formatBRL(m.gastosCents)], ["Lucro estimado", m.lucroCents === null ? "—" : formatBRL(m.lucroCents)]] as const).map(([t, v], i, arr) => (
          <div key={t} className={`flex justify-between gap-2 py-2.5 ${i ? "border-t border-line" : ""} ${i === arr.length - 1 ? "font-bold" : ""}`}><span>{t}</span><span className="tabular-nums">{v}</span></div>
        ))}
      </Card>

      <h2 className="px-1 font-display text-xl font-medium">Uso da inteligência artificial</h2>
      <Card className="flex flex-col">
        {([["Orçamentos por voz", String(c.voz)], ["Recibos lidos por foto", String(c.recibos)], ["Custo no período", formatBRL(c.custoIaCents)]] as const).map(([t, v], i) => (
          <div key={t} className={`flex justify-between gap-2 py-2.5 ${i ? "border-t border-line" : ""}`}><span className="inline-flex items-center gap-2">{i === 0 ? <Sparkles size={18} aria-hidden className="text-support" /> : null}{t}</span><b className="tabular-nums">{v}</b></div>
        ))}
        <Delta text={d.custoIa} goodWhenUp={false} />
      </Card>

      <BlocoRecolhivel title="Gastos do app" icon={Wallet} summary={stats.gastos.length ? `${stats.gastos.length} lançado${stats.gastos.length === 1 ? "" : "s"}` : "Anote o que você gasta"}>
        <Field label="O que foi"><TextInput aria-label="Descrição do gasto" maxLength={80} placeholder="Ex.: domínio medde.com.br" value={exp.desc} onChange={(e) => setExp({ ...exp, desc: e.target.value })} /></Field>
        <Field label="Valor (R$)"><NumberInput aria-label="Valor do gasto" value={exp.value} onChange={(n) => setExp({ ...exp, value: n })} /></Field>
        <Field label="Dia" hint="Se deixar vazio, vale hoje."><TextInput type="date" aria-label="Dia do gasto" value={exp.day} onChange={(e) => setExp({ ...exp, day: e.target.value })} /></Field>
        <Button icon={Plus} disabled={busy || !exp.desc.trim() || exp.value <= 0} onClick={() => void expense({ addExpense: { description: exp.desc.trim(), amountCents: Math.round(exp.value * 100), day: exp.day } })}>{busy ? "Salvando…" : "Adicionar gasto"}</Button>
        {stats.gastos.length ? (
          <ul className="flex flex-col">
            {stats.gastos.map((g, i) => (
              <li key={g.id} className={`flex items-center justify-between gap-2 py-2 ${i ? "border-t border-line" : ""}`}>
                <span className="min-w-0"><span className="block truncate font-semibold">{g.description}</span><span className="text-base text-support">{g.day.split("-").reverse().join("/")}</span></span>
                <span className="flex shrink-0 items-center gap-1"><b className="tabular-nums">{formatBRL(g.amountCents)}</b><button type="button" aria-label={`Apagar gasto ${g.description}`} disabled={busy} onClick={() => void expense({ deleteExpense: g.id })} className="grid h-12 w-12 place-items-center text-support"><Trash2 size={22} aria-hidden /></button></span>
              </li>
            ))}
          </ul>
        ) : null}
      </BlocoRecolhivel>

      <BlocoRecolhivel title="Ajustes do painel" icon={Check} summary="Meta, imposto e custos">
        <Field label="Meta de assinantes"><NumberInput aria-label="Meta de assinantes" value={form.goal} onChange={(n) => setForm({ ...form, goal: n })} /></Field>
        <Field label="Data da meta"><TextInput type="date" aria-label="Data da meta" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Imposto (%)"><NumberInput aria-label="Imposto" value={form.tax} onChange={(n) => setForm({ ...form, tax: n })} /></Field>
        <Field label="Custos fixos do mês (R$)" hint="Supabase, Vercel, domínio, conta do Google Play."><NumberInput aria-label="Custos fixos" value={form.fixed} onChange={(n) => setForm({ ...form, fixed: n })} /></Field>
        <Field label="Custo de cada orçamento por voz (R$)"><NumberInput aria-label="Custo da voz" value={form.voice} onChange={(n) => setForm({ ...form, voice: n })} /></Field>
        <Field label="Custo de cada recibo lido (R$)"><NumberInput aria-label="Custo do recibo" value={form.receipt} onChange={(n) => setForm({ ...form, receipt: n })} /></Field>
        <Button icon={Check} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar ajustes"}</Button>
        {saved ? <p role="status" className="text-base font-bold text-accent-dark">Ajustes salvos.</p> : null}
      </BlocoRecolhivel>
    </Screen>
  );
}
