"use client";
import { useRef, useState } from "react";
import { Camera, Plus, TrendingUp, X } from "lucide-react";
import { Button, Card, CardTitle, Chip, Field, NumberInput, Stepper, TextInput } from "./ui";
import { addExpense, removeExpense, setDaysWorked } from "@/modules/works";
import { dateBR, ymd } from "@/modules/workInfo";
import { cloudEnabled } from "@/modules/auth";
import { readReceipt, receiptFailureText } from "@/modules/receipt";
import { isPriceOnly } from "@/modules/quotes";
import { isSimpleMode } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { EXPENSE_LABEL, profitHint, workProfit } from "@/modules/workProfit";
import type { ExpenseKind, Quote, Work } from "@/modules/types";
import { formatBRL, toCents } from "@/shared/money";

const KINDS = Object.keys(EXPENSE_LABEL) as ExpenseKind[];
const Row = ({ label, planned, real, strong }: { label: string; planned: string; real: string; strong?: boolean }) => (
  <div className={`grid grid-cols-[1fr_auto_auto] items-baseline gap-x-2 py-1 ${strong ? "font-bold" : ""}`}>
    <span>{label}</span><span className="w-24 text-right text-support">{planned}</span><span className="w-24 text-right">{real}</span>
  </div>
);

/** Custos reais da obra e o lucro de verdade × o que o orçamento previa. */
export function WorkCostsCard({ w, quote }: { w: Work; quote?: Quote }) {
  const [amount, setAmount] = useState(0);
  const [kind, setKind] = useState<ExpenseKind>("material");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [reading, setReading] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const scan = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setReceiptMsg("");
    try {
      const r = await readReceipt(file);
      if (r.amountReais > 0) setAmount(r.amountReais);
      setKind(r.kind);
      setNote([r.store, r.description].filter(Boolean).join(" · "));
      if (r.date) setDate(r.date);
      setReceiptMsg(r.amountReais > 0 ? "Confira os dados abaixo e toque em Lançar gasto." : "Não achei o valor no recibo. Digite o valor abaixo.");
    } catch (e) {
      setReceiptMsg(receiptFailureText(e instanceof Error ? e.message : ""));
    } finally {
      setReading(false);
    }
  };
  const p = workProfit(w, quote);
  const priceOnly = !!quote && isPriceOnly(quote);
  const simple = isSimpleMode(useAppDb()?.company);
  const plan = (cents: number) => (priceOnly ? "—" : formatBRL(cents));
  const hint = priceOnly ? null : profitHint(p, quote?.result.totals.materialsCents ?? 0);
  const left = Math.max(0, w.plannedTotalCents - (w.payments ?? []).reduce((s, x) => s + x.amountCents, 0));
  const expenses = w.expenses ?? [];
  const good = p.deltaCents >= 0;
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle icon={TrendingUp}>Custos e lucro</CardTitle>
      <div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-slate-200 pb-1 text-base font-bold"><span /><span className="w-24 text-right">Previsto</span><span className="w-24 text-right">Real</span></div>
        <Row label="Combinado" planned={formatBRL(p.revenueCents)} real={formatBRL(p.revenueCents)} />
        <Row label="Gastos" planned={plan(p.plannedSpendCents)} real={formatBRL(p.spentCents)} />
        <Row label="Sobrou no bolso" planned={plan(p.plannedPocketCents)} real={formatBRL(p.realPocketCents)} strong />
        <Row label="Sua diária" planned={plan(p.plannedDiariaCents)} real={p.realDiariaCents === null ? "—" : formatBRL(p.realDiariaCents)} />
        <Row label="Lucro final" planned={plan(p.plannedProfitCents)} real={p.realProfitCents === null ? "—" : formatBRL(p.realProfitCents)} strong />
      </div>
      {priceOnly ? <p className="text-base text-support">{simple ? "Lance os gastos da obra para ver o lucro real." : "O orçamento desta obra tem só o preço, sem medidas: não há valores previstos para comparar. Lance os gastos para ver o lucro real."}</p> : null}
      <p className="text-base text-support">Lucro final = o que sobrou no bolso menos a sua diária.</p>
      {left > 0 ? <p className="text-base text-support">Ainda falta receber {formatBRL(left)}. Os números acima usam o valor combinado.</p> : null}
      {hint ? <p className={`rounded-xl p-3 text-base font-semibold ${good ? "bg-green-50 text-accent-dark" : "bg-amber-50 text-amber-900"}`}>{hint}</p> : <p className="text-base text-support">Lance os gastos da obra para ver se o orçamento acertou.</p>}
      <div className="flex items-center justify-between"><span className="text-lg">Dias trabalhados</span><Stepper value={w.daysWorked ?? 0} onChange={(n) => setDaysWorked(w.id, n)} /></div>
      {p.realDiariaCents === null ? <p className="-mt-1 text-base text-support">Informe os dias para calcular o lucro depois da diária (previsto: {w.plannedDays}).</p> : null}
      {expenses.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
          <div className="min-w-0"><b>{formatBRL(e.amountCents)}</b><div className="text-base text-support">{EXPENSE_LABEL[e.kind]}{e.note ? ` · ${e.note}` : ""} · {dateBR(e.date)}</div></div>
          <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100" aria-label="Remover gasto" onClick={() => removeExpense(w.id, e.id)}><X size={20} strokeWidth={2.4} aria-hidden /></button>
        </div>
      ))}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
        <b>Lançar gasto</b>
        {cloudEnabled ? (
          <>
            <Button variant="ghost" icon={Camera} disabled={reading} onClick={() => photoInput.current?.click()}>{reading ? "Lendo o recibo…" : "Fotografar o recibo"}</Button>
            <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden data-testid="recibo-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void scan(f); }} />
            {receiptMsg ? <p role="status" className="text-base text-support">{receiptMsg}</p> : null}
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{EXPENSE_LABEL[k]}</Chip>)}</div>
        <Field label="Valor gasto (R$)"><NumberInput aria-label="Valor gasto" value={amount} onChange={setAmount} /></Field>
        <Field label="Data do gasto"><TextInput type="date" aria-label="Data do gasto" value={date} max={ymd(new Date())} onChange={(e) => setDate(e.target.value || ymd(new Date()))} /></Field>
        <Field label="O que foi? (opcional)"><TextInput placeholder="Ex.: 2 latas de tinta" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button variant="ghost" icon={Plus} disabled={amount <= 0} onClick={() => { addExpense(w.id, { date, kind, amountCents: toCents(amount), note: note.trim() }); setAmount(0); setNote(""); setDate(ymd(new Date())); setReceiptMsg(""); }}>Lançar gasto</Button>
      </div>
    </Card>
  );
}
