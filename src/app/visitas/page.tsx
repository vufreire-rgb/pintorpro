"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { QuickVisitButton } from "@/components/QuickVisitButton";
import { Card, LinkButton, Loading, Screen } from "@/components/ui";
import { usePhotoUrl } from "@/modules/photos";
import { useAppDb } from "@/modules/useApp";
import { countByFilter, filterVisits, visitState, whenLabel, type VisitFilter } from "@/modules/visitList";
import type { Visit } from "@/modules/types";
import { fmtDate } from "@/shared/format";

function Thumb({ id }: { id?: string }) {
  const url = usePhotoUrl(id ?? "");
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-200 text-2xl">
      {id && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : "📋"}
    </div>
  );
}

const TABS: { id: VisitFilter; label: string; empty: string }[] = [
  { id: "scheduled", label: "Agendadas", empty: "Nenhuma visita agendada." },
  { id: "todo", label: "Sem orçamento", empty: "Nenhuma visita esperando orçamento." },
  { id: "quoted", label: "Orçamento feito", empty: "Nenhuma visita com orçamento ainda." },
];

function Badge({ v }: { v: Visit }) {
  const st = visitState(v);
  if (st === "scheduled") return <span className="text-brand">📅 {whenLabel(v.scheduledAt!)}</span>;
  if (st === "late") return <span className="text-red-700">⏰ Atrasada · {whenLabel(v.scheduledAt!)}</span>;
  return v.quoteId ? <span className="text-accent-dark">Orçamento feito</span> : <span className="text-amber-700">Falta orçar</span>;
}

export default function Visitas() {
  const db = useAppDb();
  const [filter, setFilter] = useState<VisitFilter>("scheduled");
  const touchX = useRef<number | null>(null);
  const list = useMemo(() => (db ? filterVisits(db.visits, db.clients, { filter }) : []), [db, filter]);
  if (!db) return <Loading />;
  const counts = countByFilter(db.visits);
  return (
    <Screen title="Visitas" nav>
      <div
        className="flex flex-col gap-4"
        onTouchStart={(e) => { touchX.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          const i = TABS.findIndex((t) => t.id === filter);
          if (dx < -60 && i < TABS.length - 1) setFilter(TABS[i + 1]!.id);
          if (dx > 60 && i > 0) setFilter(TABS[i - 1]!.id);
        }}
      >
      <div className="grid grid-cols-2 gap-3">
        <QuickVisitButton label="GRAVAR VISITA" className="!min-h-12 !text-base" />
        <LinkButton href="/visitas/agendar" variant="ghost" className="!min-h-12 !text-base">📅 Agendar</LinkButton>
      </div>
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`min-h-12 rounded-xl px-1 text-sm font-semibold leading-tight ${filter === t.id ? "bg-brand text-white" : "text-slate-700"}`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="text-slate-500">{db.visits.length === 0 ? "Nenhuma visita ainda. Na obra, toque em GRAVAR VISITA: já começa a guardar fotos, áudio e medidas." : TABS.find((t) => t.id === filter)!.empty}</p> : null}
      {list.map((v) => {
        const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
        const n = (k: number, one: string, many: string) => (k > 0 ? `${k} ${k === 1 ? one : many}` : null);
        const scheduled = visitState(v) !== "done";
        const bits = [!scheduled ? fmtDate(v.startedAt ?? v.createdAt) : null, n(v.photoIds.length, "foto", "fotos"), n((v.audios ?? []).length, "áudio", "áudios"), n((v.rooms ?? []).length, "ambiente", "ambientes")].filter(Boolean).join(" · ");
        return (
          <Link key={v.id} href={`/visitas/${v.id}`}>
            <Card className="flex gap-3">
              <Thumb id={v.photoIds[0]} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <b className="truncate">{client?.name ?? "Cliente a definir"}</b>
                  <span className="shrink-0 text-sm"><Badge v={v} /></span>
                </div>
                <div className="truncate text-sm text-slate-600">{v.siteAddress || "Sem endereço"}</div>
                {bits ? <div className="text-sm text-slate-600">{bits}</div> : null}
                {v.notes ? <div className="line-clamp-1 text-sm text-slate-700">{v.notes}</div> : null}
              </div>
            </Card>
          </Link>
        );
      })}
      </div>
    </Screen>
  );
}
