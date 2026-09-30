"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, Chip, LinkButton, Loading, Screen } from "@/components/ui";
import { isExpired } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import type { QuoteStatus } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";

export const STATUS_LABEL: Record<QuoteStatus, string> = { open: "Aberto", won: "Fechado", lost: "Perdido" };

export default function Orcamentos() {
  const db = useAppDb();
  const [tab, setTab] = useState<QuoteStatus>("open");
  if (!db) return <Loading />;
  const list = db.quotes.filter((q) => q.status === tab);
  return (
    <Screen title="Orçamentos" nav>
      <LinkButton href="/orcamentos/novo">+ NOVO ORÇAMENTO</LinkButton>
      <div className="flex gap-2">
        {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
          <Chip key={s} active={tab === s} onClick={() => setTab(s)}>{STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})</Chip>
        ))}
      </div>
      {list.length === 0 ? <p className="text-slate-500">Nada por aqui.</p> : null}
      {list.map((q) => (
        <Link key={q.id} href={`/orcamentos/${q.id}`}>
          <Card>
            <div className="flex justify-between"><b>Nº {q.number} · {db.clients.find((c) => c.id === q.clientId)?.name}</b><b>{formatBRL(q.result.totals.totalCents)}</b></div>
            <div className="text-sm text-slate-600">{fmtDate(q.createdAt)}{isExpired(q) ? " · vencido (7 dias)" : ""}</div>
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
