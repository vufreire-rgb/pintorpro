"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { FechouNotice } from "@/components/FechouNotice";
import { PixSetupCard } from "@/components/PixSetupCard";
import { BlocoRecolhivel, Badge, Button, Card, CardTitle, ConfirmDialog, LinkButton, Loading, Screen } from "@/components/ui";
import { Bell, Copy, Eye, Hammer, Link2Off, ListChecks, MoreHorizontal, PartyPopper, Pencil, RotateCcw, Send, Trash2, X } from "lucide-react";
import { cloudEnabled } from "@/modules/auth";
import { enablePush, shouldAskPush, usePushState } from "@/modules/push";
import { linkIsStale, publishLinkFor, shareLinkOnWhatsApp, unpublishLinkFor, useQuoteLinks, viewedLabel } from "@/modules/quoteLinks";
import { isSimpleMode, saveCompany } from "@/modules/settings";
import { deleteQuote, duplicateQuote, isExpired, isPriceOnly, loseQuote, quoteWorkHasData, reopenQuote, setQuoteStatus } from "@/modules/quotes";
import { sharePdfOnWhatsApp } from "@/modules/share";
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
  const [askLose, setAskLose] = useState(false);
  const router = useRouter();
  const { links, reload } = useQuoteLinks();
  const [linkMsg, setLinkMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const push = usePushState();
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
  const sendLink = () => run(async () => {
    setLinkMsg("");
    try { await shareLinkOnWhatsApp(db, q); reload(); } catch {
      // sem internet para criar o link: o PDF segue por WhatsApp no lugar
      try { await sharePdfOnWhatsApp(db, q); setLinkMsg("Não consegui criar o link (internet?). Mandei o PDF no lugar."); } catch { setLinkMsg("Não foi possível enviar agora. Tente de novo."); }
    }
  });
  const copyLink = () => run(async () => {
    setLinkMsg("");
    try {
      const url = await publishLinkFor(db, q);
      reload();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { setLinkMsg("Não consegui copiar o link. Verifique a internet e tente de novo."); }
  });
  return (
    <Screen title={`Orçamento nº ${q.number}${q.revision ? ` · rev. ${q.revision + 1}` : ""}`} back="/orcamentos">
      {db.company && !db.company.pix?.key && !db.company.pixAsked ? <PixSetupCard company={db.company} /> : null}
      <Card>
        <div className="flex items-start justify-between gap-2"><div className="text-lg font-bold">{client?.name}</div><Badge tone={q.status === "won" ? "ok" : q.status === "lost" ? "lost" : "open"}>{q.status === "won" ? "Fechado" : q.status === "lost" ? "Perdido" : "Aberto"}</Badge></div>
        <div className="text-lg text-support">{q.siteAddress}</div>
        <div className="mt-2 font-display text-[40px] font-semibold leading-[44px] text-brand">{formatBRL(t.totalCents)}</div>
        <div className="flex flex-wrap items-center gap-2 text-base text-support">
          {priceOnly ? null : <>Prazo: {plural(q.result.schedule.totalDays, "dia", "dias")} · </>}Válido até {fmtDate(q.validUntil)}{isExpired(q) ? <Badge tone="warn">Vencido</Badge> : null}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {cloudEnabled ? (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button icon={Send} className="!px-3 !text-lg" disabled={busy} onClick={sendLink}>{busy ? "Enviando…" : "Enviar pelo WhatsApp"}</Button>
              <Button variant="ghost" icon={Copy} aria-label="Copiar link" disabled={busy} className="!w-16 !px-0" onClick={copyLink} />
            </div>
            {copied ? <p role="status" className="text-base font-bold text-accent-dark">Link copiado!</p> : null}
            {links[q.id] ? (
              <div data-testid="link-status" className="flex flex-col gap-1 text-base text-support">
                <span className="inline-flex items-center gap-1.5 font-semibold text-brand"><Eye size={18} aria-hidden />{viewedLabel(links[q.id])}</span>
                {linkIsStale(q, links[q.id]) ? <span className="text-[#8A4B00]">Você editou o orçamento. Ao enviar de novo, o cliente vê a versão nova.</span> : null}
              </div>
            ) : null}
            {linkMsg ? <p className="text-base text-err">{linkMsg}</p> : null}
            {links[q.id] && shouldAskPush(push.state, db.company) ? (
              <Card className="flex flex-col gap-2 border-brand/25 bg-brand-soft">
                <p className="text-base">Quer ser avisado no celular quando o cliente abrir o orçamento?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" icon={Bell} onClick={() => void enablePush().then(() => { push.reload(); if (db.company) saveCompany({ ...db.company, pushAsked: true }); })}>Sim, avisar</Button>
                  <Button variant="ghost" size="sm" className="!bg-white" onClick={() => db.company && saveCompany({ ...db.company, pushAsked: true })}>Agora não</Button>
                </div>
              </Card>
            ) : null}
          </>
        ) : (
          <Button icon={Send} disabled={busy} onClick={() => run(() => sharePdfOnWhatsApp(db, q))}>{busy ? "Gerando PDF…" : "Enviar pelo WhatsApp"}</Button>
        )}
        {msg ? <p className="text-base text-err">{msg}</p> : null}
      </div>

      <Card className="flex flex-col gap-3">
        {q.status === "open" ? (
          <>
            <CardTitle>O cliente respondeu?</CardTitle>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button icon={PartyPopper} aria-label="Fechou! Criar a obra" onClick={() => { setFechou(true); setQuoteStatus(q.id, "won"); }}>Fechou!</Button>
              <Button variant="ghost" icon={X} className="!min-h-16" onClick={() => setAskLose(true)}>Perdeu</Button>
            </div>
            <p className="text-base text-support">Ao fechar, a obra é criada na aba Obras.</p>
          </>
        ) : q.status === "won" ? (
          <>
            <CardTitle>Fechado</CardTitle>
            <LinkButton href="/obras" variant="ghost" icon={Hammer}>Ver obra criada</LinkButton>
            <p className="text-base text-support">Fechou por engano? Volte para aberto ou marque como perdido.{quoteWorkHasData(db, q.id) ? " A obra já tem dados lançados e continua em Obras." : ""}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => reopenQuote(q.id)}>Voltar para aberto</Button>
              <Button variant="ghost" size="sm" icon={X} onClick={() => setAskLose(true)}>Perdeu</Button>
            </div>
          </>
        ) : (
          <>
            <CardTitle>{q.autoClosed ? "Perdido sozinho" : "Perdido"}</CardTitle>
            {q.autoClosed ? <p className="text-base text-support">Ficou muito tempo sem resposta depois da validade, então o app tirou da lista de abertos.</p> : null}
            <Button variant="ghost" icon={RotateCcw} onClick={() => reopenQuote(q.id)}>Reabrir (renova a validade)</Button>
          </>
        )}
      </Card>

      {priceOnly && isSimpleMode(db.company) ? null : <div className="rounded-[20px] bg-[#FFF3D6] p-4 text-lg leading-[26px] text-[#8A4B00]">
        <div className="mb-1 font-display text-lg font-semibold">Só para você (não vai no PDF)</div>
        {priceOnly ? (
          <p>Este orçamento tem só o preço, sem medidas. Por isso o app não calcula custo, lucro nem prazo. Para ver o lucro, toque em Editar orçamento e coloque as medidas.</p>
        ) : (
          <>
            <div>Custo estimado: {formatBRL(t.costCents)}</div>
            <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
          </>
        )}
      </div>}

      <BlocoRecolhivel title="Serviços" icon={ListChecks} summary={plural(q.result.serviceLines.length, "serviço", "serviços")}>
        {q.input.extras.map((e, i) => (
          <div key={i} className="flex justify-between gap-2 text-base text-ink"><span>{e.description}</span></div>
        ))}
        {q.input.rooms.map((r) => (
          <div key={r.id} className="mb-2">
            <div className="font-display text-lg font-medium">{r.name}</div>
            {q.result.serviceLines.filter((l) => l.roomId === r.id).map((l) => (
              <div key={l.serviceId} className="flex justify-between gap-2 text-base text-ink"><span>{l.name} — {fmtNum(l.quantity)} {UNIT_LABEL[l.unit]}</span><span>{formatBRL(l.totalCents)}</span></div>
            ))}
          </div>
        ))}
      </BlocoRecolhivel>
      <BlocoRecolhivel title="Mais opções" icon={MoreHorizontal}>
        {q.status === "won" ? (
          <p className="text-base text-support">Orçamento fechado não pode ser editado. Para alterar, volte para aberto antes.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {q.status === "won" ? null : <LinkButton href={`/orcamentos/novo?editar=${q.id}`} variant="ghost" size="sm" icon={Pencil} aria-label="Editar orçamento">Editar</LinkButton>}
          <Button variant="ghost" size="sm" icon={Copy} className={q.status === "won" ? "col-span-2" : ""} aria-label="Duplicar orçamento" onClick={() => { const id = duplicateQuote(db, q.id); if (id) router.push(`/orcamentos/${id}`); }}>Duplicar</Button>
        </div>
        {cloudEnabled && links[q.id] ? <Button variant="danger" size="sm" icon={Link2Off} onClick={() => { void unpublishLinkFor(q.id).then(reload); }}>Cancelar link</Button> : null}
        <Button variant="danger" icon={Trash2} onClick={() => setAskDelete(true)}>Apagar orçamento</Button>
      </BlocoRecolhivel>
      <ConfirmDialog
        open={askLose}
        title="Marcar como perdido?"
        text={`O orçamento de ${client?.name ?? "cliente"} vai para Perdido. Você pode reabrir depois.${quoteWorkHasData(db, q.id) ? " A obra continua em Obras, porque já tem pagamentos ou gastos." : ""}`}
        confirmLabel="Sim, perdeu"
        onConfirm={() => { loseQuote(q.id); setAskLose(false); }}
        onCancel={() => setAskLose(false)}
      />
      {fechou ? <FechouNotice owner={db.company?.ownerName} number={String(q.number).padStart(4, "0")} onClose={() => setFechou(false)} /> : null}
      <ConfirmDialog
        open={askDelete}
        title={`Apagar o orçamento nº ${q.number}?`}
        text={q.status === "won" ? "Ele está fechado: a obra criada a partir dele também será apagada. Isso não pode ser desfeito." : "Isso não pode ser desfeito."}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => { void unpublishLinkFor(q.id); deleteQuote(q.id); router.replace("/orcamentos"); }}
      />
      <Link href="/orcamentos/novo" className="text-center font-display text-lg font-semibold text-live">Fazer outro orçamento</Link>
    </Screen>
  );
}
