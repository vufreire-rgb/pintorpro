"use client";
import Link from "next/link";
import { useState } from "react";
import { dashboard } from "@/modules/dashboard";
import { Badge, Button, Card, Loading, Screen } from "@/components/ui";
import { CalendarDays, Check, ChartColumn, EyeOff, TriangleAlert } from "lucide-react";
import { WORK_STATUS_LABEL } from "@/modules/works";
import { lateCents } from "@/modules/finance";
import { dateLabel, paidPct, remainingCents } from "@/modules/workInfo";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

const TONE = { scheduled: "open", in_progress: "open", issues: "warn", done: "ok" } as const;

export default function Obras() {
  const db = useAppDb();
  const [showPanel, setShowPanel] = useState(false); // sempre começa recolhido: o cliente pode estar olhando
  if (!db) return <Loading />;
  const d = dashboard(db);
  const works = [...db.works].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  return (
    <Screen title="Obras" nav>
      <Button variant="ghost" icon={showPanel ? EyeOff : ChartColumn} aria-expanded={showPanel} onClick={() => setShowPanel((o) => !o)}>
        {showPanel ? "Esconder painel" : "Ver painel (valores)"}
      </Button>
      {showPanel ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Vendido no mês", formatBRL(d.soldMonthCents)],
            ["Lucro estimado do mês", formatBRL(d.profitMonthCents)],
            ["Falta receber", formatBRL(d.receivableCents)],
            ["Em atraso", formatBRL(d.lateCents)],
            ["Obras em andamento", String(d.worksActive)],
          ].map(([label, value]) => (
            <Card key={label}>
              <div className="text-base text-support">{label}</div>
              <div className="font-display text-2xl font-bold">{value}</div>
            </Card>
          ))}
        </div>
      ) : null}
      {db.works.length === 0 ? <p className="text-lg text-support">Quando você fechar um orçamento, a obra aparece aqui.</p> : null}
      {works.map((w) => (
        <Link key={w.id} href={`/obras/${w.id}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <b className="min-w-0 truncate text-lg">{db.clients.find((c) => c.id === w.clientId)?.name ?? w.title}</b>
              <Badge tone={TONE[w.status]}>{WORK_STATUS_LABEL[w.status]}</Badge>
            </div>
            <div className="line-clamp-2 text-base text-support">{db.quotes.find((q) => q.id === w.quoteId)?.siteAddress || "Sem endereço"}</div>
            <div className="flex justify-between text-base"><span className="inline-flex items-center gap-1.5"><CalendarDays size={20} strokeWidth={2.2} aria-hidden />{dateLabel(w)}</span><span className="font-display font-bold">{formatBRL(w.plannedTotalCents)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-accent" style={{ width: `${paidPct(w)}%` }} /></div>
            {remainingCents(w) > 0 ? <div className="text-base font-bold text-brand">Falta receber {formatBRL(remainingCents(w))}</div> : <div className="inline-flex items-center gap-1.5 text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden />Tudo recebido</div>}
            {lateCents(w) > 0 ? <div className="inline-flex items-center gap-1.5 text-base font-bold text-[#8A4B00]"><TriangleAlert size={20} strokeWidth={2.4} aria-hidden />{formatBRL(lateCents(w))} em atraso</div> : null}
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
