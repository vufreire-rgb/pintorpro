"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { FechouNotice } from "@/components/FechouNotice";
import { PixSetupCard } from "@/components/PixSetupCard";
import { Badge, Button, Card, CardTitle, Chip, ConfirmDialog, LinkButton, Loading, Screen } from "@/components/ui";
import { Copy, FileText, Link2, Pencil, Send, Trash2 } from "lucide-react";
import { cloudEnabled } from "@/modules/auth";
import { linkIsStale, linkUrl, shareLinkOnWhatsApp, unpublishLinkFor, useQuoteLinks, viewedLabel } from "@/modules/quoteLinks";
import { isSimpleMode } from "@/modules/settings";
import { deleteQuote, duplicateQuote, isExpired, isPriceOnly, setQuoteStatus } from "@/modules/quotes";
import { downloadPdf, sharePdfOnWhatsApp } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";
import { fmtDate, fmtNum, plural, UNIT_LABEL } from "@/shared/format";

export default function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [fechou, setFechou] = useState(false);
  const router = useRouter();
  const { links, reload } = useQuoteLinks();
  const [linkMsg, setLinkMsg] = useState("");
  if (!db) return <Loading />;
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return <Screen title="Orçamento" back="/orcamentos"><p>Orçamento não encontrado.</p></Screen>;
  const t = q.result.totals;
  const client = db.clients.find((c) => c.id === q.clientId);
  const priceOnly = isPriceOnly(q);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg("");
    try { await fn(); } catch { setMsg("Não foi possível gerar o PDF. Tente de novo."); } finally { setBusy(false); }
  };
  return (
    <Screen title={`Orçamento nº ${q.number}${q.revision ? ` · rev. ${q.revision + 1}` : ""}`} back="/orcamentos">
      {db.company && !db.company.pix?.key && !db.company.pixAsked ? <PixSetupCard company={db.company} /> : null}
      <Card>
        <div className="flex items-start justify-between gap-2"><div className="font-display text-[22px] font-bold leading-7">{client?.name}</div><Badge tone={q.status === "won" ? "ok" : q.status === "lost" ? "lost" : "open"}>{q.status === "won" ? "Fechado" : q.status === "lost" ? "Perdido" : "Aberto"}</Badge></div>
        <div className="text-lg text-support">{q.siteAddress}</div>
        <div className="mt-2 font-display text-[40px] font-extrabold leading-[44px] text-brand">{formatBRL(t.totalCents)}</div>
        <div className="flex flex-wrap items-center gap-2 text-base text-support">
          {priceOnly ? null : <>Prazo: {plural(q.result.schedule.totalDays, "dia", "dias")} · </>}Válido até {fmtDate(q.validUntil)}{isExpired(q) ? <Badge tone="warn">Vencido</Badge> : null}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Button icon={Send} disabled={busy} onClick={() => run(() => sharePdfOnWhatsApp(db, q))}>{busy ? "Gerando PDF…" : "Enviar pelo WhatsApp"}</Button>
        <Button variant="ghost" icon={FileText} disabled={busy} onClick={() => run(() => downloadPdf(db, q))}>Ver PDF</Button>
        {msg ? <p className="text-base text-err">{msg}</p> : null}
        {cloudEnabled ? (
          <>
            <Button variant="ghost" icon={Link2} disabled={busy} onClick={() => run(async () => { setLinkMsg(""); try { await shareLinkOnWhatsApp(db, q); reload(); } catch { setLinkMsg("Não consegui criar o link. Verifique a internet e tente de novo."); } })}>{links[q.id] ? "Enviar o link de novo" : "Enviar link (avisa quando abrir)"}</Button>
            {linkMsg ? <p className="text-base text-err">{linkMsg}</p> : null}
            {links[q.id] ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-brand/25 bg-brand-soft p-3 text-base" data-testid="link-status">
                <div className="font-semibold">{viewedLabel(links[q.id])}</div>
                {linkIsStale(q, links[q.id]) ? <div className="text-[#8A4B00]">Você editou o orçamento. Toque em &quot;Enviar o link de novo&quot; para o cliente ver a versão nova.</div> : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => { void navigator.clipboard?.writeText(linkUrl(links[q.id]!.token)); setLinkMsg(""); }}>Copiar link</Button>
                  <Button variant="danger" onClick={() => { void unpublishLinkFor(q.id).then(reload); }}>Cancelar link</Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Situação</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Chip active={q.status === "open"} onClick={() => setQuoteStatus(q.id, "open")}>Aberto</Chip>
          <Chip active={q.status === "won"} onClick={() => { if (q.status !== "won") setFechou(true); setQuoteStatus(q.id, "won"); }}>Fechado</Chip>
          <Chip active={q.status === "lost"} onClick={() => setQuoteStatus(q.id, "lost")}>Perdido</Chip>
        </div>
        {q.status === "won" ? <LinkButton href="/obras" variant="ghost">Ver obra criada →</LinkButton> : null}
      </Card>

      {priceOnly && isSimpleMode(db.company) ? null : <Card className="border-amber-300 bg-amber-50">
        <div className="mb-1 font-display text-lg font-bold">Só para você (não vai no PDF)</div>
        {priceOnly ? (
          <p>Este orçamento tem só o preço, sem medidas. Por isso o app não calcula custo, lucro nem prazo. Para ver o lucro, toque em Editar orçamento e coloque as medidas.</p>
        ) : (
          <>
            <div>Custo estimado: {formatBRL(t.costCents)}</div>
            <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
          </>
        )}
      </Card>}

      <Card>
        <div className="mb-2 font-display text-[22px] font-bold leading-7">Serviços</div>
        {q.input.extras.map((e, i) => (
          <div key={i} className="flex justify-between gap-2 text-base text-ink"><span>{e.description}</span></div>
        ))}
        {q.input.rooms.map((r) => (
          <div key={r.id} className="mb-2">
            <div className="text-lg font-bold">{r.name}</div>
            {q.result.serviceLines.filter((l) => l.roomId === r.id).map((l) => (
              <div key={l.serviceId} className="flex justify-between gap-2 text-base text-ink"><span>{l.name} — {fmtNum(l.quantity)} {UNIT_LABEL[l.unit]}</span><span>{formatBRL(l.totalCents)}</span></div>
            ))}
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <CardTitle>Mais opções</CardTitle>
        {q.status === "won" ? (
          <p className="text-base text-support">Orçamento fechado não pode ser editado. Para alterar, marque como <b>Aberto</b> antes.</p>
        ) : (
          <LinkButton href={`/orcamentos/novo?editar=${q.id}`} variant="ghost" icon={Pencil}>Editar orçamento</LinkButton>
        )}
        <Button variant="ghost" icon={Copy} onClick={() => { const id = duplicateQuote(db, q.id); if (id) router.push(`/orcamentos/${id}`); }}>Duplicar orçamento</Button>
        <Button variant="danger" icon={Trash2} onClick={() => setAskDelete(true)}>Apagar orçamento</Button>
      </Card>
      {fechou ? <FechouNotice owner={db.company?.ownerName} number={String(q.number).padStart(4, "0")} onClose={() => setFechou(false)} /> : null}
      <ConfirmDialog
        open={askDelete}
        title={`Apagar o orçamento nº ${q.number}?`}
        text={q.status === "won" ? "Ele está fechado: a obra criada a partir dele também será apagada. Isso não pode ser desfeito." : "Isso não pode ser desfeito."}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => { void unpublishLinkFor(q.id); deleteQuote(q.id); router.replace("/orcamentos"); }}
      />
      <Link href="/orcamentos/novo" className="text-center text-lg font-bold text-brand underline">Fazer outro orçamento</Link>
    </Screen>
  );
}
