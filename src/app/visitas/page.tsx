"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { QuickVisitButton } from "@/components/QuickVisitButton";
import { Card, Chip, LinkButton, Loading, Screen, TextInput } from "@/components/ui";
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

const FILTERS: { id: VisitFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "scheduled", label: "Agendadas" },
  { id: "todo", label: "Falta orçar" },
  { id: "quoted", label: "Orçadas" },
];

function Badge({ v }: { v: Visit }) {
  const st = visitState(v);
  if (st === "scheduled") return <span className="text-brand">📅 {whenLabel(v.scheduledAt!)}</span>;
  if (st === "late") return <span className="text-red-700">⏰ Atrasada · {whenLabel(v.scheduledAt!)}</span>;
  return v.quoteId ? <span className="text-accent-dark">Orçamento feito</span> : <span className="text-amber-700">Falta orçar</span>;
}

export default function Visitas() {
  const db = useAppDb();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisitFilter>("all");
  const list = useMemo(() => (db ? filterVisits(db.visits, db.clients, { query, filter }) : []), [db, query, filter]);
  if (!db) return <Loading />;
  const counts = countByFilter(db.visits);
  return (
    <Screen title="Visitas" nav>
      <QuickVisitButton />
      <LinkButton href="/visitas/agendar" variant="ghost">📅 Agendar visita</LinkButton>
      {db.visits.length > 0 ? (
        <>
          <TextInput type="search" placeholder="Buscar cliente, endereço ou ambiente…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar visitas" />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} ({counts[f.id]})</Chip>)}
          </div>
        </>
      ) : <p className="text-slate-500">Nenhuma visita ainda. Na obra, toque em GRAVAR VISITA: já começa a guardar fotos, áudio e medidas.</p>}
      {db.visits.length > 0 && list.length === 0 ? <p className="text-slate-500">Nenhuma visita encontrada.</p> : null}
      {list.map((v) => {
        const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
        const bits = [`${v.photoIds.length} foto(s)`, `${(v.audios ?? []).length} áudio(s)`, (v.rooms ?? []).length ? `${v.rooms!.length} ambiente(s)` : null].filter(Boolean).join(" · ");
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
                <div className="text-sm text-slate-600">{fmtDate(v.startedAt ?? v.createdAt)} · {bits}</div>
                {v.notes ? <div className="line-clamp-1 text-sm text-slate-700">{v.notes}</div> : null}
              </div>
            </Card>
          </Link>
        );
      })}
    </Screen>
  );
}
