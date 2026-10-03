"use client";
import Link from "next/link";
import { Card, Loading, Screen } from "@/components/ui";
import { WORK_STATUS_LABEL } from "@/modules/works";
import { dateLabel, paidPct, remainingCents } from "@/modules/workInfo";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

const TONE = { scheduled: "text-brand", in_progress: "text-accent-dark", issues: "text-red-700", done: "text-slate-500" } as const;

export default function Obras() {
  const db = useAppDb();
  if (!db) return <Loading />;
  const receivable = db.works.reduce((s, w) => s + remainingCents(w), 0);
  const works = [...db.works].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  return (
    <Screen title="Obras" nav>
      {db.works.length === 0 ? <p className="text-slate-500">Quando você fechar um orçamento, a obra aparece aqui.</p> : (
        <Card className="border-brand/30 bg-brand-soft">
          <div className="text-sm text-slate-600">Falta receber (todas as obras)</div>
          <div className="text-2xl font-bold text-brand">{formatBRL(receivable)}</div>
        </Card>
      )}
      {works.map((w) => (
        <Link key={w.id} href={`/obras/${w.id}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <b className="min-w-0 truncate">{db.clients.find((c) => c.id === w.clientId)?.name ?? w.title}</b>
              <span className={`shrink-0 text-sm font-semibold ${TONE[w.status]}`}>{WORK_STATUS_LABEL[w.status]}</span>
            </div>
            <div className="truncate text-sm text-slate-600">{db.quotes.find((q) => q.id === w.quoteId)?.siteAddress || "Sem endereço"}</div>
            <div className="flex justify-between text-sm"><span>📅 {dateLabel(w)}</span><span>{formatBRL(w.plannedTotalCents)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-accent" style={{ width: `${paidPct(w)}%` }} /></div>
            <div className="text-sm text-slate-600">{remainingCents(w) > 0 ? `Falta receber ${formatBRL(remainingCents(w))}` : "✓ Tudo recebido"}</div>
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
