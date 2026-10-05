"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { ContactActions } from "@/components/ContactActions";
import { PhotoGrid } from "@/components/PhotoGrid";
import { PixModal } from "@/components/PixModal";
import { Button, Card, Chip, ConfirmDialog, Field, LinkButton, Loading, NumberInput, Screen, TextInput } from "@/components/ui";
import { buildPlan, chargeMessage, lateCents, planGapCents, planView, PLAN_PRESET_LABEL, type InstallmentState, type PlanPreset } from "@/modules/finance";
import { normalizePixKey, pixPayload } from "@/modules/pix";
import { storePhotos, useFileUrl } from "@/modules/photos";
import { METHOD_LABEL } from "@/modules/receiptData";
import { downloadWorkIcs, shareCharge, shareProof, shareReceipt } from "@/modules/share";
import { waUrl } from "@/modules/visitList";
import { useAppDb } from "@/modules/useApp";
import { dateBR, ymd, paidCents, paidPct, remainingCents } from "@/modules/workInfo";
import { addInstallment, addPayment, deleteWork, removeInstallment, removePayment, setPlan, setWorkEnd, setWorkStart, setWorkStatus, updateInstallment, WORK_STATUS_LABEL } from "@/modules/works";
import type { PaymentMethod, WorkStatus } from "@/modules/types";
import { formatBRL, toCents } from "@/shared/money";

function Player({ id }: { id: string }) {
  const url = useFileUrl(id);
  return url ? <audio controls src={url} className="w-full" /> : <p className="text-sm text-slate-500">Áudio não está neste aparelho.</p>;
}

const NOTES = ["Entrada", "Parcela", "Pagamento final"];
const STATE_BADGE: Record<InstallmentState, { text: string; cls: string }> = {
  paid: { text: "✓ Paga", cls: "text-accent-dark" },
  partial: { text: "Paga em parte", cls: "text-amber-700" },
  late: { text: "⚠ Atrasada", cls: "text-red-700" },
  due_soon: { text: "Vence em breve", cls: "text-amber-700" },
  open: { text: "Em aberto", cls: "text-slate-500" },
};
const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

function ProofThumb({ id }: { id: string }) {
  const url = useFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Comprovante" className="h-12 w-12 rounded-lg object-cover" /></a> : null;
}

export default function ObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const router = useRouter();
  const [askDelete, setAskDelete] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("Entrada");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [proof, setProof] = useState<File | null>(null);
  const [pixModal, setPixModal] = useState<{ code: string; title: string; amount: string } | null>(null);
  const [changePlan, setChangePlan] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const proofInput = useRef<HTMLInputElement>(null);
  const send = async (job: () => Promise<"shared" | "downloaded" | "missing">, fail: string) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await job();
      if (r === "downloaded") setMsg("O arquivo foi baixado e o WhatsApp foi aberto. Se ele não aparecer na conversa, toque no clipe 📎 do WhatsApp e escolha o arquivo baixado.");
      if (r === "missing") setMsg("Esse arquivo não está neste aparelho.");
    } catch {
      setMsg(fail);
    } finally {
      setBusy(false);
    }
  };
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
  const view = planView(w);
  const nextInst = view.find((p) => p.state !== "paid");
  const late = lateCents(w);
  const gap = planGapCents(w);
  const pixCfg = db.company?.pix;
  const pixOk = !!pixCfg && !!normalizePixKey(pixCfg.type, pixCfg.key);
  const pixFor = (cents: number) => (pixOk && pixCfg ? pixPayload(pixCfg, { name: db.company!.name, city: db.company!.city }, cents) : "");
  const makePlan = (preset: PlanPreset) => { setPlan(w.id, buildPlan(preset, w.plannedTotalCents, depositPct, w.startDate ?? ymd(new Date()), w.endDate)); setChangePlan(false); };
  const register = async () => {
    setBusy(true);
    try {
      const proofId = proof ? (await storePhotos([proof]))[0] : undefined;
      addPayment(w.id, { date: ymd(new Date()), amountCents: toCents(amount), note, method, proofId });
      setAmount(0);
      setProof(null);
      setNote(payments.length === 0 ? "Parcela" : "Pagamento final");
    } finally {
      setBusy(false);
    }
  };

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
        <h2 className="text-lg font-bold">🗓 Plano de pagamento</h2>
        {late > 0 ? <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">⚠ {formatBRL(late)} em atraso</p> : null}
        {view.length === 0 || changePlan ? (
          <>
            <p className="text-sm text-slate-600">{view.length === 0 ? "Combine as parcelas com o cliente. Escolha um modelo e ajuste depois." : "Escolher outro modelo apaga as parcelas atuais (os pagamentos já registrados ficam)."}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLAN_PRESET_LABEL) as PlanPreset[]).map((pr) => <Chip key={pr} active={false} onClick={() => makePlan(pr)}>{PLAN_PRESET_LABEL[pr]}</Chip>)}
            </div>
            {changePlan ? <Button variant="ghost" className="!min-h-12 !text-base" onClick={() => setChangePlan(false)}>Cancelar</Button> : null}
          </>
        ) : (
          <>
            {view.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><b>{p.label}</b><div className="text-sm text-slate-600">vence {dateBR(p.dueDate)}</div></div>
                  <div className="text-right"><b>{formatBRL(p.amountCents)}</b><div className={`text-sm font-semibold ${STATE_BADGE[p.state].cls}`}>{STATE_BADGE[p.state].text}</div></div>
                </div>
                {p.state !== "paid" ? (
                  <div className="flex gap-2">
                    {client?.phone ? <a className="grid min-h-11 flex-1 place-items-center rounded-xl bg-white px-2 text-[15px] font-semibold" href={waUrl(client.phone, chargeMessage(p, client.name, db.company!.name, pixFor(p.amountCents - p.coveredCents)))} target="_blank" rel="noreferrer">💬 Cobrar</a> : null}
                    <button className="min-h-11 flex-1 rounded-xl bg-white px-2 text-[15px] font-semibold disabled:opacity-50" disabled={busy} onClick={() => send(() => shareCharge(db, w, p), "Não consegui gerar a cobrança em PDF. Tente de novo.")}>📄 PDF</button>
                    {pixOk ? <button className="min-h-11 flex-1 rounded-xl bg-white px-2 text-[15px] font-semibold" onClick={() => setPixModal({ code: pixFor(p.amountCents - p.coveredCents), title: `${p.label} · Pix`, amount: formatBRL(p.amountCents - p.coveredCents) })}>📱 Pix</button> : null}
                  </div>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Editar parcela</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Vence em"><TextInput type="date" value={p.dueDate} onChange={(e) => e.target.value && updateInstallment(w.id, p.id, { dueDate: e.target.value })} /></Field>
                    <Field label="Valor (R$)"><NumberInput value={p.amountCents / 100} onChange={(n) => updateInstallment(w.id, p.id, { amountCents: toCents(n) })} /></Field>
                  </div>
                  <button className="mt-2 min-h-10 text-red-700 underline" onClick={() => removeInstallment(w.id, p.id)}>Remover parcela</button>
                </details>
              </div>
            ))}
            {gap !== 0 ? <p className="text-sm text-amber-800">A soma das parcelas {gap > 0 ? `está ${formatBRL(gap)} abaixo` : `está ${formatBRL(-gap)} acima`} do valor combinado.</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" className="!min-h-12 !text-base" onClick={() => addInstallment(w.id, { label: `Parcela ${view.length}`, dueDate: ymd(new Date()), amountCents: Math.max(0, gap) })}>+ Parcela</Button>
              <Button variant="ghost" className="!min-h-12 !text-base" onClick={() => setChangePlan(true)}>Trocar modelo</Button>
            </div>
          </>
        )}
        {!pixOk ? <p className="text-sm text-slate-500">Cadastre sua chave Pix em Ajustes para mandar o Pix copia e cola nas cobranças.</p> : null}
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
            <div className="min-w-0 flex-1">
              <b>{formatBRL(p.amountCents)}</b>
              <div className="text-sm text-slate-600">{p.note} · {dateBR(p.date)}{p.method ? ` · ${METHOD_LABEL[p.method]}` : ""}</div>
              <button className="mt-1 min-h-9 text-sm font-semibold text-brand underline disabled:opacity-50" disabled={busy} onClick={() => send(() => shareReceipt(db, w, p), "Não consegui gerar o recibo. Tente de novo.")}>🧾 Recibo</button>
              {p.proofId ? <button className="ml-4 mt-1 min-h-9 text-sm font-semibold text-brand underline disabled:opacity-50" disabled={busy} onClick={() => send(() => shareProof(db, w, p), "Não consegui enviar o comprovante. Tente de novo.")}>📤 Enviar comprovante</button> : null}
            </div>
            {p.proofId ? <ProofThumb id={p.proofId} /> : null}
            <button className="h-10 w-10 shrink-0 rounded-full bg-slate-200" aria-label="Remover pagamento" onClick={() => removePayment(w.id, p.id, p.proofId)}>✕</button>
          </div>
        ))}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
          <b>Registrar pagamento</b>
          <div className="flex flex-wrap gap-2">
            {nextInst ? <Chip active={false} onClick={() => { setNote(nextInst.label); setAmount((nextInst.amountCents - nextInst.coveredCents) / 100); }}>{nextInst.label} · {formatBRL(nextInst.amountCents - nextInst.coveredCents)}</Chip> : null}
            {NOTES.map((n) => <Chip key={n} active={note === n} onClick={() => { setNote(n); if (n === "Entrada") setAmount(depositCents / 100); if (n === "Pagamento final") setAmount(left / 100); }}>{n}</Chip>)}
          </div>
          <Field label="Valor recebido (R$)" hint={payments.length === 0 ? `Entrada sugerida (${depositPct}%): ${formatBRL(depositCents)}` : undefined}><NumberInput value={amount} onChange={setAmount} /></Field>
          <div>
            <p className="mb-2 font-medium">Como pagou?</p>
            <div className="flex flex-wrap gap-2">{METHODS.map((m) => <Chip key={m} active={method === m} onClick={() => setMethod(m)}>{METHOD_LABEL[m]}</Chip>)}</div>
          </div>
          <input ref={proofInput} type="file" accept="image/*" hidden data-testid="proof-input" onChange={(e) => { setProof(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <Button variant="ghost" className="!min-h-12 !text-base" onClick={() => proofInput.current?.click()}>{proof ? `📎 ${proof.name.slice(0, 24)} (trocar)` : "📎 Anexar comprovante (opcional)"}</Button>
          <Button disabled={amount <= 0 || busy} onClick={register}>Registrar</Button>
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

      {msg ? <button className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-2xl bg-slate-900 p-4 text-left text-white shadow-lg" onClick={() => setMsg("")}>{msg}<span className="mt-1 block text-xs text-white/70">Toque para fechar</span></button> : null}
      {pixModal ? <PixModal {...pixModal} onClose={() => setPixModal(null)} /> : null}
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
