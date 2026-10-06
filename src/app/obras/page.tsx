"use client";
import Link from "next/link";
import { useState } from "react";
import { dashboard } from "@/modules/dashboard";
import { Badge, Button, Card, Loading, Screen } from "@/components/ui";
import { CalendarDays, Check, ChartColumn, EyeOff, TriangleAlert } from "lucide-react";
import { createExampleWork, WORK_STATUS_LABEL } from "@/modules/works";
import { AutoTour, type TourStep } from "@/components/Tour";
import { useRouter } from "next/navigation";
import { lateCents } from "@/modules/finance";
import { dateLabel, paidPct, remainingCents } from "@/modules/workInfo";
import { workProfit } from "@/modules/workProfit";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

const TONE = { scheduled: "open", in_progress: "open", issues: "warn", done: "ok" } as const;

export default function Obras() {
  const db = useAppDb();
  const router = useRouter();
  const [showPanel, setShowPanel] = useState(false); // sempre começa recolhido: o cliente pode estar olhando
  const steps: TourStep[] = [
    { target: "obras-painel", title: "Painel com os valores", text: "Os valores ficam escondidos para o cliente não ver. Toque aqui para ver o vendido no mês, o que falta receber, o que está em atraso e o lucro real." },
    { target: "obras-lista", title: "Suas obras", text: "Quando você fecha um orçamento, a obra aparece aqui com o quanto falta receber. Vou abrir uma obra de exemplo para você conhecer, e depois você apaga.", button: "Abrir obra de exemplo" },
  ];
  if (!db) return <Loading />;
  const d = dashboard(db);
  const works = [...db.works].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  // Lucro real × previsto das obras do mês que já têm gastos lançados.
  const month = new Date().toISOString().slice(0, 7);
  const tracked = db.works.filter((w) => !w.isExample && w.createdAt.startsWith(month) && (w.expenses?.length ?? 0) > 0).map((w) => workProfit(w, db.quotes.find((q) => q.id === w.quoteId)));
  const realCents = tracked.reduce((a, p) => a + (p.realProfitCents ?? p.realPocketCents), 0);
  const plannedCents = tracked.reduce((a, p) => a + (p.realProfitCents === null ? p.plannedPocketCents : p.plannedProfitCents), 0);
  return (
    <Screen title="Obras" nav>
      <div data-tour="obras-painel">
      <Button variant="ghost" icon={showPanel ? EyeOff : ChartColumn} aria-expanded={showPanel} onClick={() => setShowPanel((o) => !o)}>
        {showPanel ? "Esconder painel" : "Ver painel (valores)"}
      </Button>
      </div>
      {showPanel ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Vendido no mês", formatBRL(d.soldMonthCents)],
            ["Lucro estimado do mês", formatBRL(d.profitMonthCents)],
            ["Falta receber", formatBRL(d.receivableCents)],
            ["Em atraso", formatBRL(d.lateCents)],
            ...(tracked.length ? [["Lucro real do mês", formatBRL(realCents)], ["Previsto dessas obras", formatBRL(plannedCents)]] : []),
            ["Obras em andamento", String(d.worksActive)],
          ].map(([label, value]) => (
            <Card key={label}>
              <div className="text-base text-support">{label}</div>
              <div className="font-display text-2xl font-bold">{value}</div>
            </Card>
          ))}
        </div>
      ) : null}
      <div data-tour="obras-lista" className="flex flex-col gap-4">
      {db.works.length === 0 ? <p className="text-lg text-support">Quando você fechar um orçamento, a obra aparece aqui.</p> : null}
      {works.map((w) => (
        <Link key={w.id} href={`/obras/${w.id}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <b className="min-w-0 truncate text-lg">{db.clients.find((c) => c.id === w.clientId)?.name ?? w.title}</b>
              <span className="flex shrink-0 gap-2">{w.isExample ? <Badge tone="lost">Exemplo</Badge> : null}<Badge tone={TONE[w.status]}>{WORK_STATUS_LABEL[w.status]}</Badge></span>
            </div>
            <div className="line-clamp-2 text-base text-support">{db.quotes.find((q) => q.id === w.quoteId)?.siteAddress || "Sem endereço"}</div>
            <div className="flex justify-between text-base"><span className="inline-flex items-center gap-1.5"><CalendarDays size={20} strokeWidth={2.2} aria-hidden />{dateLabel(w)}</span><span className="font-display font-bold">{formatBRL(w.plannedTotalCents)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-accent" style={{ width: `${paidPct(w)}%` }} /></div>
            {remainingCents(w) > 0 ? <div className="text-base font-bold text-brand">Falta receber {formatBRL(remainingCents(w))}</div> : <div className="inline-flex items-center gap-1.5 text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden />Tudo recebido</div>}
            {lateCents(w) > 0 ? <div className="inline-flex items-center gap-1.5 text-base font-bold text-[#8A4B00]"><TriangleAlert size={20} strokeWidth={2.4} aria-hidden />{formatBRL(lateCents(w))} em atraso</div> : null}
          </Card>
        </Link>
      ))}
      </div>
      <AutoTour id="obras" steps={steps} onFinish={() => router.push(`/obras/${db.works.find((x) => x.isExample)?.id ?? createExampleWork()}`)} />
    </Screen>
  );
}
