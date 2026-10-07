"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Loading, Screen } from "@/components/ui";
import { monthKey, monthLabel, monthReport, shiftMonth } from "@/modules/monthReport";
import { isSimpleMode } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

/** Resultado do mês: quanto vendeu, recebeu, gastou e o que sobrou no caixa. */
export default function ResultadoDoMes() {
  const db = useAppDb();
  const now = monthKey(new Date());
  const [month, setMonth] = useState(now);
  if (!db) return <Loading />;
  const r = monthReport(db, month);
  const simple = isSimpleMode(db.company);
  const rows: [string, string, string?][] = [
    ["Vendido", formatBRL(r.soldCents), r.soldCount ? `${r.soldCount} ${r.soldCount === 1 ? "orçamento fechado" : "orçamentos fechados"} no mês` : "Orçamentos fechados no mês"],
    ["Recebido", formatBRL(r.receivedCents), "Pagamentos que entraram no mês"],
    ["Gastos", formatBRL(r.spentCents), "Material, ajudante e outros gastos lançados"],
  ];
  return (
    <Screen title="Resultado do mês" back="/obras">
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex items-center justify-between gap-2">
          <button aria-label="Mês anterior" className="grid h-12 w-12 place-items-center rounded-full border-2 border-slate-200 bg-white" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={24} aria-hidden /></button>
          <b className="font-display text-xl" data-testid="mes">{monthLabel(month).replace(/^./, (c) => c.toUpperCase())}</b>
          <button aria-label="Próximo mês" disabled={month >= now} className="grid h-12 w-12 place-items-center rounded-full border-2 border-slate-200 bg-white disabled:opacity-40" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={24} aria-hidden /></button>
        </div>

        <Card className="text-center">
          <div className="text-base text-support">Sobrou no caixa em {monthLabel(month)}</div>
          <div className={`font-display text-[40px] font-extrabold leading-[44px] ${r.netCents < 0 ? "text-err" : "text-brand"}`} data-testid="sobrou">{formatBRL(r.netCents)}</div>
          <div className="text-base text-support">Recebido menos gastos</div>
        </Card>

        <Card className="flex flex-col divide-y divide-slate-100">
          {rows.map(([label, value, hint]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div><div className="text-lg font-semibold">{label}</div>{hint ? <div className="text-base text-support">{hint}</div> : null}</div>
              <b className="font-display text-xl" data-testid={`r-${label.toLowerCase()}`}>{value}</b>
            </div>
          ))}
        </Card>

        <Card className="flex flex-col divide-y divide-slate-100">
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <div><div className="text-lg font-semibold">Falta receber</div><div className="text-base text-support">De todas as obras, hoje</div></div>
            <b className="font-display text-xl" data-testid="r-falta">{formatBRL(r.toReceiveCents)}</b>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-3">
            <div><div className="text-lg font-semibold">Em atraso</div><div className="text-base text-support">Parcelas vencidas e não pagas</div></div>
            <b className={`font-display text-xl ${r.lateCents > 0 ? "text-err" : ""}`} data-testid="r-atraso">{formatBRL(r.lateCents)}</b>
          </div>
          <div className="flex items-baseline justify-between gap-3 pt-3">
            <div className="text-lg font-semibold">Obras em andamento</div>
            <b className="font-display text-xl" data-testid="r-andamento">{r.activeWorks}</b>
          </div>
        </Card>
        {simple ? (r.trackedWorks > 0 ? (
          <Card className="flex items-baseline justify-between gap-3">
            <div><div className="text-lg font-semibold">Lucro real do mês</div><div className="text-base text-support">Das obras com gastos lançados</div></div>
            <b className="font-display text-xl" data-testid="r-lucro-real">{formatBRL(r.realProfitCents)}</b>
          </Card>
        ) : null) : (
          <Card className="flex flex-col divide-y divide-slate-100">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <div><div className="text-lg font-semibold">Lucro estimado</div><div className="text-base text-support">Dos orçamentos fechados no mês, pelos seus preços</div></div>
              <b className="font-display text-xl" data-testid="r-lucro-estimado">{formatBRL(r.estimatedProfitCents)}</b>
            </div>
            {r.trackedWorks > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-3 py-3">
                  <div><div className="text-lg font-semibold">Lucro real</div><div className="text-base text-support">Das obras com gastos lançados</div></div>
                  <b className="font-display text-xl" data-testid="r-lucro-real">{formatBRL(r.realProfitCents)}</b>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-3">
                  <div><div className="text-lg font-semibold">Previsto dessas obras</div></div>
                  <b className="font-display text-xl" data-testid="r-previsto">{formatBRL(r.plannedProfitCents)}</b>
                </div>
              </>
            ) : null}
          </Card>
        )}
        <p className="text-base text-support">Os valores contam só o que você lançou nas obras (pagamentos e gastos). Obras de treino ficam de fora.</p>
      </div>
    </Screen>
  );
}
