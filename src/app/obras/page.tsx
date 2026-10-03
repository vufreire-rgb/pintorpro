"use client";
import Link from "next/link";
import { useState } from "react";
import { dashboard } from "@/modules/dashboard";
import { Button, Card, Loading, Screen } from "@/components/ui";
import { WORK_STATUS_LABEL } from "@/modules/works";
import { dateLabel, paidPct, remainingCents } from "@/modules/workInfo";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

const TONE = { scheduled: "text-brand", in_progress: "text-accent-dark", issues: "text-red-700", done: "text-slate-500" } as const;

export default function Obras() {
  const db = useAppDb();
  const [showPanel, setShowPanel] = useState(false); // sempre começa recolhido: o cliente pode estar olhando
  if (!db) return <Loading />;
  const d = dashboard(db);
  const works = [...db.works].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  return (
    <Screen title="Obras" nav>
      <Button variant="ghost" className="!min-h-12 !text-base" aria-expanded={showPanel} onClick={() => setShowPanel((o) => !o)}>
        {showPanel ? "🙈 Esconder painel" : "📊 Ver painel (valores)"}
      </Button>
      {showPanel ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Vendido no mês", formatBRL(d.soldMonthCents)],
            ["Lucro estimado do mês", formatBRL(d.profitMonthCents)],
            ["Falta receber", formatBRL(d.receivableCents)],
            ["Obras em andamento", String(d.worksActive)],
          ].map(([label, value]) => (
            <Card key={label}>
              <div className="text-sm text-slate-500">{label}</div>
              <div className="text-xl font-bold">{value}</div>
            </Card>
          ))}
        </div>
      ) : null}
      {db.works.length === 0 ? <p className="text-slate-500">Quando você fechar um orçamento, a obra aparece aqui.</p> : null}
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
