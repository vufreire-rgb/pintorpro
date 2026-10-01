"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Button, Card, ConfirmDialog, LinkButton, Loading, Screen } from "@/components/ui";
import { deleteQuote, duplicateQuote, isExpired, setQuoteStatus } from "@/modules/quotes";
import { downloadPdf, sharePdfOnWhatsApp } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";
import { fmtDate, fmtNum, UNIT_LABEL } from "@/shared/format";

export default function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const router = useRouter();
  if (!db) return <Loading />;
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return <Screen title="Orçamento" back="/orcamentos"><p>Orçamento não encontrado.</p></Screen>;
  const t = q.result.totals;
  const client = db.clients.find((c) => c.id === q.clientId);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg("");
    try { await fn(); } catch { setMsg("Não foi possível gerar o PDF. Tente de novo."); } finally { setBusy(false); }
  };
  return (
    <Screen title={`Orçamento nº ${q.number}${q.revision ? ` · rev. ${q.revision + 1}` : ""}`} back="/orcamentos">
      <Card>
        <div className="text-lg font-semibold">{client?.name}</div>
        <div className="text-slate-600">{q.siteAddress}</div>
        <div className="mt-2 text-3xl font-bold text-blue-700">{formatBRL(t.totalCents)}</div>
        <div className="text-sm text-slate-600">
          Prazo: {q.result.schedule.totalDays} dia(s) · Válido até {fmtDate(q.validUntil)}{isExpired(q) ? " (vencido)" : ""}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Button disabled={busy} onClick={() => run(() => sharePdfOnWhatsApp(db, q))}>{busy ? "Gerando PDF…" : "Enviar pelo WhatsApp"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => run(() => downloadPdf(db, q))}>Ver PDF</Button>
        {msg ? <p className="text-red-600">{msg}</p> : null}
      </div>

      <Card className="flex flex-col gap-2">
        <div className="font-bold">Situação</div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant={q.status === "open" ? "primary" : "ghost"} className="text-base" onClick={() => setQuoteStatus(q.id, "open")}>Aberto</Button>
          <Button variant={q.status === "won" ? "success" : "ghost"} className="text-base" onClick={() => setQuoteStatus(q.id, "won")}>Fechado</Button>
          <Button variant={q.status === "lost" ? "danger" : "ghost"} className="text-base" onClick={() => setQuoteStatus(q.id, "lost")}>Perdido</Button>
        </div>
        {q.status === "won" ? <LinkButton href="/obras" variant="ghost">Ver obra criada →</LinkButton> : null}
      </Card>

      <Card className="border-amber-300 bg-amber-50">
        <div className="mb-1 font-bold">Só para você (não vai no PDF)</div>
        <div>Custo estimado: {formatBRL(t.costCents)}</div>
        <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">Serviços</div>
        {q.input.rooms.map((r) => (
          <div key={r.id} className="mb-2">
            <div className="font-medium">{r.name}</div>
            {q.result.serviceLines.filter((l) => l.roomId === r.id).map((l) => (
              <div key={l.serviceId} className="flex justify-between text-sm text-slate-700"><span>{l.name} — {fmtNum(l.quantity)} {UNIT_LABEL[l.unit]}</span><span>{formatBRL(l.totalCents)}</span></div>
            ))}
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="font-bold">Mais opções</div>
        {q.status === "won" ? (
          <p className="text-sm text-slate-600">Orçamento fechado não pode ser editado. Para alterar, marque como <b>Aberto</b> antes.</p>
        ) : (
          <LinkButton href={`/orcamentos/novo?editar=${q.id}`} variant="ghost">✏️ Editar orçamento</LinkButton>
        )}
        <Button variant="ghost" onClick={() => { const id = duplicateQuote(db, q.id); if (id) router.push(`/orcamentos/${id}`); }}>📄 Duplicar orçamento</Button>
        <Button variant="ghost" className="text-red-700" onClick={() => setAskDelete(true)}>🗑 Apagar orçamento</Button>
      </Card>
      <ConfirmDialog
        open={askDelete}
        title={`Apagar o orçamento nº ${q.number}?`}
        text={q.status === "won" ? "Ele está fechado: a obra criada a partir dele também será apagada. Isso não pode ser desfeito." : "Isso não pode ser desfeito."}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => { deleteQuote(q.id); router.replace("/orcamentos"); }}
      />
      <Link href="/orcamentos/novo" className="text-center text-blue-700 underline">Fazer outro orçamento</Link>
    </Screen>
  );
}
