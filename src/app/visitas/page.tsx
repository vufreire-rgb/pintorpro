"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InstallBanner } from "@/components/InstallBanner";
import { AutoTour, type TourStep } from "@/components/Tour";
import { QuickVisitButton } from "@/components/QuickVisitButton";
import { BrandHeader } from "@/components/BrandHeader";
import { Badge, Card, LinkButton, Loading, Screen } from "@/components/ui";
import { CalendarDays, ClipboardList } from "lucide-react";
import { createExampleVisit } from "@/modules/visits";
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
      ) : <ClipboardList size={28} strokeWidth={2} aria-hidden className="text-support" />}
    </div>
  );
}

const TABS: { id: VisitFilter; label: string; empty: string }[] = [
  { id: "scheduled", label: "Agendadas", empty: "Nenhuma visita agendada." },
  { id: "todo", label: "Sem orçamento", empty: "Nenhuma visita esperando orçamento." },
  { id: "quoted", label: "Orçamento feito", empty: "Nenhuma visita com orçamento ainda." },
];

function VisitBadge({ v }: { v: Visit }) {
  const st = visitState(v);
  if (st === "scheduled") return <span className="inline-flex items-center gap-1.5 font-bold text-brand"><CalendarDays size={18} strokeWidth={2.2} aria-hidden />{whenLabel(v.scheduledAt!)}</span>;
  if (st === "late") return <Badge tone="warn">Atrasada · {whenLabel(v.scheduledAt!)}</Badge>;
  return v.quoteId ? <Badge tone="ok">Orçamento feito</Badge> : <Badge tone="warn">Falta orçar</Badge>;
}

export default function Visitas() {
  const db = useAppDb();
  const [filter, setFilter] = useState<VisitFilter>("scheduled");
  const router = useRouter();
  const touchX = useRef<number | null>(null);
  const list = useMemo(() => (db ? filterVisits(db.visits, db.clients, { filter }) : []), [db, filter]);
  const steps: TourStep[] = [
    { target: "gravar", title: "Gravar ou agendar", text: "Gravar visita começa uma visita agora, com fotos, medidas e áudio. Agendar marca uma visita para outro dia. Dá para colocá-la na agenda do celular, que avisa na hora." },
    { target: "abas", title: "Suas visitas em 3 abas", text: "Agendadas, Sem orçamento e Orçamento feito. Toque numa aba ou deslize para os lados." },
    { target: "lista", title: "Vamos treinar", text: "Cada visita aparece aqui. Vou abrir uma visita de exemplo para você treinar, e depois você apaga.", button: "Abrir visita de exemplo" },
  ];
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
      <BrandHeader />
      <InstallBanner />
      <div data-tour="gravar" className="grid grid-cols-2 gap-3">
        <QuickVisitButton label="Gravar visita" className="!px-3 !text-lg" />
        <LinkButton href="/visitas/agendar" variant="ghost" icon={CalendarDays} className="!px-3 !text-lg">Agendar</LinkButton>
      </div>
      <div data-tour="abas" role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`min-h-12 rounded-xl px-1 text-base font-bold leading-tight ${filter === t.id ? "bg-brand text-white" : "text-ink"}`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>
      <div data-tour="lista" className="flex flex-col gap-4">
      {list.length === 0 ? <p className="text-lg text-support">{db.visits.length === 0 ? "Nenhuma visita ainda. Toque no botão verde para começar: ele já guarda fotos, áudio e medidas." : TABS.find((t) => t.id === filter)!.empty}</p> : null}
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
                  <b className="truncate text-lg">{client?.name ?? "Cliente a definir"}</b>
                  
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2"><VisitBadge v={v} />{v.isExample ? <Badge tone="lost">Exemplo</Badge> : null}</div>
                <div className="mt-1 line-clamp-2 text-base text-support">{v.siteAddress || "Sem endereço"}</div>
                {bits ? <div className="text-base text-support">{bits}</div> : null}
                {v.notes ? <div className="line-clamp-1 text-base text-ink">{v.notes}</div> : null}
              </div>
            </Card>
          </Link>
        );
      })}
      </div>
      </div>
      <AutoTour id="visitas" steps={steps} onFinish={() => router.push(`/visitas/${db.visits.find((x) => x.isExample)?.id ?? createExampleVisit()}`)} />
    </Screen>
  );
}
