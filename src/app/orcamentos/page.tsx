"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, ConfirmDialog, LinkButton, Loading, Screen, TAB_LIST_CLS, tabCls } from "@/components/ui";
import { Check, Eye, Inbox, Mic, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { SwipeRow } from "@/components/SwipeRow";
import { UndoBar } from "@/components/UndoBar";
import { isExpired, loseQuote, quoteWorkHasData, reopenQuote, setQuoteStatus } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import { useHint } from "@/modules/hints";
import { daysWaiting, needsFollowUp } from "@/modules/followUp";
import { usePendingVoice } from "@/modules/voice";
import { agoLabel, useQuoteLinks } from "@/modules/quoteLinks";
import { useRequests } from "@/modules/publicPage";
import { cloudEnabled } from "@/modules/auth";
import type { QuoteStatus } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";

export const STATUS_LABEL: Record<QuoteStatus, string> = { open: "Aberto", won: "Fechado", lost: "Perdido" };

const TABS: QuoteStatus[] = ["open", "won", "lost"];

export default function Orcamentos() {
  const db = useAppDb();
  const hint = useHint("orcamentos", (db?.quotes.length ?? 0) > 0);
  const voicePending = usePendingVoice().length;
  const { links } = useQuoteLinks();
  const allRequests = useRequests().requests;
  const newRequests = allRequests.filter((r) => r.status === "new").length;
  const [tab, setTab] = useState<QuoteStatus>("open");
  const [choosing, setChoosing] = useState(false);
  const touchX = useRef<number | null>(null);
  const [askLose, setAskLose] = useState<{ id: string; name: string } | null>(null);
  const [undo, setUndo] = useState<{ message: string; back: () => void } | null>(null);
  if (!db) return <Loading />;
  const list = db.quotes.filter((q) => q.status === tab);
  return (
    <Screen title="Orçamentos" nav>
      <div
        className="flex flex-col gap-4"
        onTouchStart={(e) => { touchX.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          const i = TABS.indexOf(tab);
          if (dx < -60 && i < TABS.length - 1) setTab(TABS[i + 1]!);
          if (dx > 60 && i > 0) setTab(TABS[i - 1]!);
        }}
      >
      <div className="flex flex-col gap-3">
        {cloudEnabled ? (
          <>
            <Button icon={Plus} aria-expanded={choosing} onClick={() => setChoosing((o) => !o)}>Novo orçamento</Button>
            {choosing ? (
              <div className="grid grid-cols-2 gap-3">
                <LinkButton href="/orcamentos/voz" icon={Mic} variant="ghost" className="!px-3 !text-lg">Falar{voicePending > 0 ? ` (${voicePending} aguardando)` : ""}</LinkButton>
                <LinkButton href="/orcamentos/novo" icon={Pencil} variant="ghost" className="!px-3 !text-lg">Digitar</LinkButton>
              </div>
            ) : voicePending > 0 ? (
              <Link href="/orcamentos/voz" className="text-center font-display text-lg font-semibold text-live">{voicePending} {voicePending === 1 ? "áudio aguardando" : "áudios aguardando"} para virar orçamento</Link>
            ) : null}
          </>
        ) : (
          <LinkButton href="/orcamentos/novo" icon={Plus}>Novo orçamento</LinkButton>
        )}
        {newRequests > 0 ? <LinkButton href="/pedidos" icon={Inbox} variant="ghost" className="!px-3 !text-lg">{newRequests} {newRequests === 1 ? "pedido novo" : "pedidos novos"} de clientes</LinkButton> : allRequests.length > 0 ? <LinkButton href="/pedidos" icon={Inbox} variant="ghost" className="!px-3 !text-lg">Pedidos de clientes ({allRequests.length})</LinkButton> : null}
      </div>
      <div role="tablist" className={`${TAB_LIST_CLS} grid-cols-3`}>
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={tabCls(tab === s)}
          >
            {STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})
          </button>
        ))}
      </div>
      {tab === "open" && list.length > 0 ? <div className="text-lg text-support">Total em aberto: <b>{formatBRL(list.reduce((s, q) => s + q.result.totals.totalCents, 0))}</b></div> : null}
      {list.length === 0 ? <p className="text-lg text-support">Nada por aqui.</p> : null}
      {hint && tab === "open" && list.length > 0 ? <p className="text-base text-support">Dica: deslize o orçamento para a direita se fechou, ou para a esquerda se perdeu.</p> : null}
      {hint && tab === "won" && list.length > 0 ? <p className="text-base text-support">Fechou por engano? Deslize para a direita para voltar a aberto, ou para a esquerda se perdeu.</p> : null}
      {hint && tab === "lost" && list.length > 0 ? <p className="text-base text-support">Dica: deslize para a direita para reabrir.</p> : null}
      {list.map((q) => {
        const name = db.clients.find((c) => c.id === q.clientId)?.name ?? "cliente";
        const card = (
          <Link href={`/orcamentos/${q.id}`}>
            <Card>
              <div className="flex justify-between gap-2 text-lg"><b className="min-w-0 truncate">Nº {q.number} · {name}</b><b className="font-display text-xl font-semibold">{formatBRL(q.result.totals.totalCents)}</b></div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-base text-support">{fmtDate(q.createdAt)}{isExpired(q) ? <Badge tone="warn">Vencido (7 dias)</Badge> : null}{q.autoClosed ? <Badge tone="lost">Sem resposta</Badge> : null}{needsFollowUp(q) ? <Badge tone="warn">Sem resposta há {daysWaiting(q)} dias</Badge> : null}{links[q.id]?.lastViewedAt ? <span className="inline-flex items-center gap-1 font-semibold text-brand"><Eye size={16} aria-hidden />Visto {agoLabel(links[q.id]!.lastViewedAt!)}</span> : null}</div>
            </Card>
          </Link>
        );
        if (q.status === "open") {
          return (
            <SwipeRow
              key={q.id}
              right={{ label: "Fechou", icon: <Check size={24} aria-hidden />, className: "bg-[#0A8545]" }}
              left={{ label: "Perdeu", icon: <X size={24} aria-hidden />, className: "bg-[#5B6B80]" }}
              onRight={() => { setQuoteStatus(q.id, "won"); setUndo({ message: `Fechou: ${name}. A obra foi criada.`, back: () => reopenQuote(q.id) }); }}
              onLeft={() => setAskLose({ id: q.id, name })}
            >{card}</SwipeRow>
          );
        }
        if (q.status === "won") {
          return (
            <SwipeRow
              key={q.id}
              right={{ label: "Voltar a aberto", icon: <RotateCcw size={24} aria-hidden />, className: "bg-brand" }}
              left={{ label: "Perdeu", icon: <X size={24} aria-hidden />, className: "bg-[#5B6B80]" }}
              onRight={() => { reopenQuote(q.id); setUndo({ message: `Voltou a aberto: ${name}.`, back: () => setQuoteStatus(q.id, "won") }); }}
              onLeft={() => setAskLose({ id: q.id, name })}
            >{card}</SwipeRow>
          );
        }
        if (q.status === "lost") {
          return (
            <SwipeRow
              key={q.id}
              right={{ label: "Reabrir", icon: <RotateCcw size={24} aria-hidden />, className: "bg-brand" }}
              onRight={() => { reopenQuote(q.id); setUndo({ message: `Reaberto: ${name}.`, back: () => setQuoteStatus(q.id, "lost") }); }}
            >{card}</SwipeRow>
          );
        }
        return <div key={q.id}>{card}</div>;
      })}
      <ConfirmDialog
        open={!!askLose}
        title="Marcar como perdido?"
        text={askLose ? `O orçamento de ${askLose.name} vai para Perdido. Você pode reabrir depois.${quoteWorkHasData(db, askLose.id) ? " A obra dele continua em Obras, porque já tem pagamentos ou gastos." : ""}` : ""}
        confirmLabel="Sim, perdeu"
        onConfirm={() => { if (askLose) { loseQuote(askLose.id); setUndo({ message: `Perdido: ${askLose.name}.`, back: () => reopenQuote(askLose.id) }); } setAskLose(null); }}
        onCancel={() => setAskLose(null)}
      />
      {undo ? <UndoBar message={undo.message} onUndo={() => { undo.back(); setUndo(null); }} onDone={() => setUndo(null)} /> : null}
      </div>
    </Screen>
  );
}
