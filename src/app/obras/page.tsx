"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, LinkButton, Loading, Screen } from "@/components/ui";
import { SwipeRow, type SwipeAction } from "@/components/SwipeRow";
import { UndoBar } from "@/components/UndoBar";
import { CalendarDays, Check, ChartColumn, CircleCheck, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { setWorkStatus, WORK_STATUS_LABEL } from "@/modules/works";
import type { Work, WorkStatus } from "@/modules/types";
import { lateCents } from "@/modules/finance";
import { dateLabel, paidPct, remainingCents } from "@/modules/workInfo";
import { useAppDb } from "@/modules/useApp";
import { useHint } from "@/modules/hints";
import { formatBRL } from "@/shared/money";

const TONE = { scheduled: "open", in_progress: "open", issues: "warn", done: "ok" } as const;

const GREEN = "bg-[#0A8545]", GREY = "bg-[#5B6B80]";
const ACT: Record<string, SwipeAction> = {
  start: { label: "Começar", icon: <Play size={24} aria-hidden />, className: GREEN },
  done: { label: "Concluir", icon: <CircleCheck size={24} aria-hidden />, className: GREEN },
  issue: { label: "Pendência", icon: <TriangleAlert size={24} aria-hidden />, className: "bg-[#B26A00]" },
  solved: { label: "Resolvi", icon: <Check size={24} aria-hidden />, className: GREY },
  reopen: { label: "Reabrir", icon: <RotateCcw size={24} aria-hidden />, className: "bg-brand" },
};

/** O que o deslize faz em cada situação da obra: [para a direita, para a esquerda]. */
function swipeFor(status: WorkStatus): [{ act: SwipeAction; to: WorkStatus } | null, { act: SwipeAction; to: WorkStatus } | null] {
  if (status === "scheduled") return [{ act: ACT.start!, to: "in_progress" }, null];
  if (status === "in_progress") return [{ act: ACT.done!, to: "done" }, { act: ACT.issue!, to: "issues" }];
  if (status === "issues") return [{ act: ACT.done!, to: "done" }, { act: ACT.solved!, to: "in_progress" }];
  return [{ act: ACT.reopen!, to: "in_progress" }, null];
}

export default function Obras() {
  const db = useAppDb();
  const hint = useHint("obras", (db?.works.length ?? 0) > 0);
  const [undo, setUndo] = useState<{ message: string; back: () => void } | null>(null);
  const move = (w: Work, to: WorkStatus, name: string) => {
    const prev = w.status;
    setWorkStatus(w.id, to);
    setUndo({ message: `${name}: ${WORK_STATUS_LABEL[to].toLowerCase()}.`, back: () => setWorkStatus(w.id, prev) });
  };
  if (!db) return <Loading />;
  const works = [...db.works].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  return (
    <Screen title="Obras" nav>
      <div>
        <LinkButton href="/obras/resultado" variant="ghost" icon={ChartColumn}>Resultado do mês (valores)</LinkButton>
      </div>
      <div className="flex flex-col gap-4">
      {db.works.length === 0 ? <p className="text-lg text-support">Quando você fechar um orçamento, a obra aparece aqui.</p> : null}
      {hint && works.length > 0 ? <p className="text-base text-support">Dica: deslize a obra para o lado para começar, concluir ou marcar pendência.</p> : null}
      {works.map((w) => {
        const name = db.clients.find((c) => c.id === w.clientId)?.name ?? w.title;
        const [r, l] = swipeFor(w.status);
        return (
        <SwipeRow key={w.id} right={r?.act} left={l?.act} onRight={r ? () => move(w, r.to, name) : undefined} onLeft={l ? () => move(w, l.to, name) : undefined}>
        <Link href={`/obras/${w.id}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <b className="min-w-0 truncate text-lg">{db.clients.find((c) => c.id === w.clientId)?.name ?? w.title}</b>
              <span className="flex shrink-0 gap-2">{w.isExample ? <Badge tone="lost">Exemplo</Badge> : null}<Badge tone={TONE[w.status]}>{WORK_STATUS_LABEL[w.status]}</Badge></span>
            </div>
            <div className="line-clamp-2 text-base text-support">{db.quotes.find((q) => q.id === w.quoteId)?.siteAddress || "Sem endereço"}</div>
            <div className="flex justify-between text-base"><span className="inline-flex items-center gap-1.5"><CalendarDays size={20} strokeWidth={2.2} aria-hidden />{dateLabel(w)}</span><span className="font-display text-xl font-semibold">{formatBRL(w.plannedTotalCents)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-accent" style={{ width: `${paidPct(w)}%` }} /></div>
            {remainingCents(w) > 0 ? <div className="text-base font-bold text-brand">Falta receber {formatBRL(remainingCents(w))}</div> : <div className="inline-flex items-center gap-1.5 text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden />Tudo recebido</div>}
            {lateCents(w) > 0 ? <div className="inline-flex items-center gap-1.5 text-base font-bold text-[#8A4B00]"><TriangleAlert size={20} strokeWidth={2.4} aria-hidden />{formatBRL(lateCents(w))} em atraso</div> : null}
          </Card>
        </Link>
        </SwipeRow>
        );
      })}
      {undo ? <UndoBar message={undo.message} onUndo={() => { undo.back(); setUndo(null); }} onDone={() => setUndo(null)} /> : null}
      </div>
    </Screen>
  );
}
