"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ContactActions } from "@/components/ContactActions";
import { PhotoGrid } from "@/components/PhotoGrid";
import { Button, Card, Chip, ConfirmDialog, Field, LinkButton, Loading, NumberInput, Screen, TextInput } from "@/components/ui";
import { useFileUrl } from "@/modules/photos";
import { downloadWorkIcs } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { dateBR, ymd, paidCents, paidPct, remainingCents } from "@/modules/workInfo";
import { addPayment, deleteWork, removePayment, setWorkEnd, setWorkStart, setWorkStatus, WORK_STATUS_LABEL } from "@/modules/works";
import type { WorkStatus } from "@/modules/types";
import { formatBRL, toCents } from "@/shared/money";

function Player({ id }: { id: string }) {
  const url = useFileUrl(id);
  return url ? <audio controls src={url} className="w-full" /> : <p className="text-sm text-slate-500">Áudio não está neste aparelho.</p>;
}

const NOTES = ["Entrada", "Parcela", "Pagamento final"];

export default function ObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const router = useRouter();
  const [askDelete, setAskDelete] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("Entrada");
  if (!db) return <Loading />;
  const w = db.works.find((x) => x.id === id);
  if (!w) return <Screen title="Obra" back="/obras"><p>Obra não encontrada.</p></Screen>;
  const client = db.clients.find((c) => c.id === w.clientId);
  const quote = db.quotes.find((q) => q.id === w.quoteId);
  const visit = quote?.visitId ? db.visits.find((v) => v.id === quote.visitId) : undefined;
  const depositPct = quote?.depositPct ?? db.company?.depositPct ?? 50;
  const depositCents = Math.round((w.plannedTotalCents * depositPct) / 100);
  const payments = w.payments ?? [];
  const left = remainingCents(w);

  return (
    <Screen title={client?.name ?? "Obra"} back="/obras">
      <Card className="flex flex-col gap-3">
        <div className="text-slate-600">{quote?.siteAddress || "Sem endereço"}</div>
        <ContactActions phone={client?.phone} address={quote?.siteAddress || client?.address} location={visit?.location} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((s) => (
            <Chip key={s} active={w.status === s} onClick={() => setWorkStatus(w.id, s)}>{WORK_STATUS_LABEL[s]}</Chip>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">📅 Datas</h2>
        <p className="text-sm text-slate-600">Previsto no orçamento: {w.plannedDays} dia(s) de trabalho.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Começa em"><TextInput type="date" value={w.startDate ?? ""} onChange={(e) => setWorkStart(w.id, e.target.value)} /></Field>
          <Field label="Termina em"><TextInput type="date" value={w.endDate ?? ""} min={w.startDate} onChange={(e) => setWorkEnd(w.id, e.target.value)} /></Field>
        </div>
        {w.startDate ? <Button variant="ghost" onClick={() => downloadWorkIcs(w, client, quote?.siteAddress ?? "")}>🗓 Adicionar à agenda do celular</Button> : <p className="text-sm text-slate-500">Escolha o dia de início para lembrar na agenda.</p>}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">💰 Dinheiro da obra</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xs text-slate-500">Combinado</div><b>{formatBRL(w.plannedTotalCents)}</b></div>
          <div><div className="text-xs text-slate-500">Recebido</div><b className="text-accent-dark">{formatBRL(paidCents(w))}</b></div>
          <div><div className="text-xs text-slate-500">Falta</div><b className={left > 0 ? "text-red-700" : "text-accent-dark"}>{formatBRL(left)}</b></div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-accent" style={{ width: `${paidPct(w)}%` }} /></div>
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <div><b>{formatBRL(p.amountCents)}</b><div className="text-sm text-slate-600">{p.note} · {dateBR(p.date)}</div></div>
            <button className="h-10 w-10 shrink-0 rounded-full bg-slate-200" aria-label="Remover pagamento" onClick={() => removePayment(w.id, p.id)}>✕</button>
          </div>
        ))}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
          <b>Registrar pagamento</b>
          <div className="flex flex-wrap gap-2">{NOTES.map((n) => <Chip key={n} active={note === n} onClick={() => { setNote(n); if (n === "Entrada") setAmount(depositCents / 100); if (n === "Pagamento final") setAmount(left / 100); }}>{n}</Chip>)}</div>
          <Field label="Valor recebido (R$)" hint={payments.length === 0 ? `Entrada sugerida (${depositPct}%): ${formatBRL(depositCents)}` : undefined}><NumberInput value={amount} onChange={setAmount} /></Field>
          <Button disabled={amount <= 0} onClick={() => { addPayment(w.id, { date: ymd(new Date()), amountCents: toCents(amount), note }); setAmount(0); setNote(payments.length === 0 ? "Parcela" : "Pagamento final"); }}>Registrar</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">📋 Orçamento e visita</h2>
        {quote ? <LinkButton href={`/orcamentos/${quote.id}`} variant="ghost">Ver orçamento nº {String(quote.number).padStart(3, "0")}</LinkButton> : null}
        {visit ? (
          <>
            {visit.notes ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-700">{visit.notes}</p> : null}
            {(visit.rooms ?? []).length > 0 ? <p className="text-sm text-slate-600">{visit.rooms!.map((r) => r.name).join(" · ")}</p> : null}
            <PhotoGrid ids={visit.photoIds} marksOf={(pid) => visit.photoMeta?.[pid]?.marks} />
            {(visit.audios ?? []).map((a) => <Player key={a.id} id={a.id} />)}
            <Link href={`/visitas/${visit.id}`} className="text-brand underline">Abrir a visita completa</Link>
          </>
        ) : <p className="text-sm text-slate-500">Este orçamento não veio de uma visita gravada.</p>}
      </Card>

      <Button variant="ghost" className="text-base text-red-700" onClick={() => setAskDelete(true)}>Apagar obra</Button>
      <ConfirmDialog
        open={askDelete}
        title="Apagar esta obra?"
        text="O orçamento fechado continua existindo. Os pagamentos registrados nesta obra serão apagados. Isso não pode ser desfeito."
        onCancel={() => setAskDelete(false)}
        onConfirm={() => { deleteWork(w.id); router.replace("/obras"); }}
      />
    </Screen>
  );
}
