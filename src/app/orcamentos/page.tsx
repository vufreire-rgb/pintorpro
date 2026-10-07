"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, LinkButton, Loading, Screen } from "@/components/ui";
import { Eye, Inbox, Mic, Pencil, Plus } from "lucide-react";
import { isExpired } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
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
  const voicePending = usePendingVoice().length;
  const { links } = useQuoteLinks();
  const newRequests = useRequests().requests.filter((r) => r.status === "new").length;
  const [tab, setTab] = useState<QuoteStatus>("open");
  const [choosing, setChoosing] = useState(false);
  const touchX = useRef<number | null>(null);
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
              <Link href="/orcamentos/voz" className="text-center text-base font-semibold text-brand underline">{voicePending} {voicePending === 1 ? "áudio aguardando" : "áudios aguardando"} para virar orçamento</Link>
            ) : null}
          </>
        ) : (
          <LinkButton href="/orcamentos/novo" icon={Plus}>Novo orçamento</LinkButton>
        )}
        {newRequests > 0 ? <LinkButton href="/pedidos" icon={Inbox} variant="ghost" className="!px-3 !text-lg">{newRequests} {newRequests === 1 ? "pedido novo" : "pedidos novos"} de clientes</LinkButton> : null}
      </div>
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`min-h-12 rounded-xl px-1 text-base font-bold leading-tight ${tab === s ? "bg-brand text-white" : "text-ink"}`}
          >
            {STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})
          </button>
        ))}
      </div>
      {tab === "open" && list.length > 0 ? <div className="text-lg text-support">Total em aberto: <b>{formatBRL(list.reduce((s, q) => s + q.result.totals.totalCents, 0))}</b></div> : null}
      {list.length === 0 ? <p className="text-lg text-support">Nada por aqui.</p> : null}
      {list.map((q) => (
        <Link key={q.id} href={`/orcamentos/${q.id}`}>
          <Card>
            <div className="flex justify-between gap-2 text-lg"><b className="min-w-0 truncate">Nº {q.number} · {db.clients.find((c) => c.id === q.clientId)?.name}</b><b className="font-display">{formatBRL(q.result.totals.totalCents)}</b></div>
            <div className="mt-1 flex items-center gap-2 text-base text-support">{fmtDate(q.createdAt)}{isExpired(q) ? <Badge tone="warn">Vencido (7 dias)</Badge> : null}{links[q.id]?.lastViewedAt ? <span className="inline-flex items-center gap-1 font-semibold text-brand"><Eye size={16} aria-hidden />Visto {agoLabel(links[q.id]!.lastViewedAt!)}</span> : null}</div>
          </Card>
        </Link>
      ))}
      </div>
    </Screen>
  );
}
