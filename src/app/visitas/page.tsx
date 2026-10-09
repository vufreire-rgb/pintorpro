"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InstallBanner } from "@/components/InstallBanner";
import { FirstSteps } from "@/components/FirstSteps";
import { BrandMark } from "@/components/BrandHeader";
import { Badge, Button, Card, ConfirmDialog, LinkButton, Loading, Screen, TAB_LIST_CLS, tabCls } from "@/components/ui";
import { SwipeRow } from "@/components/SwipeRow";
import { ArrowLeft, CalendarDays, ClipboardList, FilePlus2, FileText, Play, Plus, Trash2 } from "lucide-react";
import { startQuickVisit } from "@/modules/quickVisit";
import { deleteVisit, startVisit } from "@/modules/visits";
import { usePhotoUrl } from "@/modules/photos";
import { useAppDb } from "@/modules/useApp";
import { useHint } from "@/modules/hints";
import { countByFilter, filterVisits, firstFilledFilter, visitState, whenLabel, type VisitFilter } from "@/modules/visitList";
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
  { id: "todo", label: "A orçar", empty: "Nenhuma visita esperando orçamento." },
];
const QUOTED_EMPTY = "Nenhuma visita com orçamento feito ainda.";

function VisitBadge({ v }: { v: Visit }) {
  const st = visitState(v);
  if (st === "scheduled") return <span className="inline-flex items-center gap-1.5 font-semibold text-brand"><CalendarDays size={18} strokeWidth={2.2} aria-hidden />{whenLabel(v.scheduledAt!)}</span>;
  if (st === "late") return <Badge tone="warn">Atrasada · {whenLabel(v.scheduledAt!)}</Badge>;
  return v.quoteId ? <Badge tone="ok">Orçamento feito</Badge> : <Badge tone="warn">Falta orçar</Badge>;
}

export default function Visitas() {
  const db = useAppDb();
  // Abre na primeira aba que tem visita (assim ninguém pensa que perdeu tudo); depois a pessoa escolhe.
  const [picked, setPicked] = useState<VisitFilter | null>(null);
  const filter: VisitFilter = picked ?? (db ? firstFilledFilter(db.visits) : "scheduled");
  const router = useRouter();
  const touchX = useRef<number | null>(null);
  const [askDelete, setAskDelete] = useState<{ id: string; name: string; scheduled: boolean } | null>(null);
  const list = useMemo(() => (db ? filterVisits(db.visits, db.clients, { filter }) : []), [db, filter]);
  const hint = useHint("visitas", list.length > 0);
  if (!db) return <Loading />;
  const counts = countByFilter(db.visits);
  return (
    <Screen title="Visitas" nav corner={<Link href="/configuracoes" className="grid h-12 w-12 place-items-center" aria-label={`${db.company?.name ?? "Meu negócio"} · Ajustes`}><BrandMark size={38} /></Link>}>
      <div
        className="flex flex-col gap-4"
        onTouchStart={(e) => { touchX.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          const i = TABS.findIndex((t) => t.id === filter);
          if (i < 0) return;
          if (dx < -60 && i < TABS.length - 1) setPicked(TABS[i + 1]!.id);
          if (dx > 60 && i > 0) setPicked(TABS[i - 1]!.id);
        }}
      >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Button icon={Plus} className="whitespace-nowrap !px-3" onClick={() => router.push(startQuickVisit())}>Nova visita</Button>
        <LinkButton href="/visitas/agendar" variant="ghost" icon={CalendarDays} className="!w-auto !px-3 whitespace-nowrap">Agendar</LinkButton>
      </div>
      <FirstSteps db={db} />
      {filter === "quoted" ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-medium">Visitas com orçamento feito</h2>
          <Button variant="ghost" size="sm" icon={ArrowLeft} className="!w-auto" onClick={() => setPicked(counts.scheduled > 0 ? "scheduled" : "todo")}>Voltar</Button>
        </div>
      ) : db.visits.length === 0 ? null : (
        <div role="tablist" className={`${TAB_LIST_CLS} grid-cols-2`}>
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setPicked(t.id)}
              className={tabCls(filter === t.id)}
            >
              {t.label}
              <span className="text-base">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4">
      {hint && list.length > 0 ? <p className="text-base text-support">{filter === "scheduled" ? "Dica: deslize a visita para a direita para começar, ou para a esquerda para cancelar." : filter === "todo" ? "Dica: deslize para a direita para montar o orçamento, ou para a esquerda para apagar a visita." : "Dica: deslize para a direita para ver o orçamento."}</p> : null}
      {list.length === 0 && db.visits.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand"><ClipboardList size={28} strokeWidth={2.2} aria-hidden /></span>
          <h2 className="font-display text-xl font-medium">Registre sua primeira visita</h2>
          <p className="text-lg text-support">Nenhuma visita ainda. Toque em <b>Nova visita</b> para começar: ela já guarda fotos, áudio e medidas.</p>
        </Card>
      ) : list.length === 0 ? <p className="text-lg text-support">{filter === "quoted" ? QUOTED_EMPTY : TABS.find((t) => t.id === filter)!.empty}</p> : null}
      {list.map((v) => {
        const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
        const n = (k: number, one: string, many: string) => (k > 0 ? `${k} ${k === 1 ? one : many}` : null);
        const scheduled = visitState(v) !== "done";
        const bits = [!scheduled ? fmtDate(v.startedAt ?? v.createdAt) : null, n(v.photoIds.length, "foto", "fotos"), n((v.audios ?? []).length, "áudio", "áudios"), n((v.rooms ?? []).length, "ambiente", "ambientes")].filter(Boolean).join(" · ");
        const quick = scheduled
          ? { label: "Começar visita", icon: <Play size={24} strokeWidth={2.4} aria-hidden />, go: () => { startVisit(v.id); router.push(`/visitas/${v.id}`); } }
          : !v.quoteId
            ? { label: "Montar orçamento", icon: <FilePlus2 size={24} strokeWidth={2.4} aria-hidden />, go: () => router.push(`/orcamentos/novo?visita=${v.id}`) }
            : { label: "Ver orçamento", icon: <FileText size={24} strokeWidth={2.4} aria-hidden />, go: () => router.push(`/orcamentos/${v.quoteId}`) };
        const card = (
          <div className="relative">
          <Link href={`/visitas/${v.id}`}>
            <Card className="flex gap-3 pr-[72px]">
              <Thumb id={v.photoIds[0]} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <b className="truncate text-lg font-bold">{client?.name ?? "Cliente a definir"}</b>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2"><VisitBadge v={v} />{v.isExample ? <Badge tone="lost">Exemplo</Badge> : null}</div>
                <div className="mt-1 line-clamp-2 text-base text-support">{v.siteAddress || "Sem endereço"}</div>
                {bits ? <div className="text-base text-support">{bits}</div> : null}
                {v.notes ? <div className="line-clamp-1 text-base text-ink">{v.notes}</div> : null}
              </div>
            </Card>
          </Link>
          <button
            type="button"
            onClick={quick.go}
            aria-label={`${quick.label} de ${client?.name ?? "cliente a definir"}`}
            className="absolute right-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-brand text-white shadow-sm active:scale-95"
          >{quick.icon}</button>
          </div>
        );
        const name = client?.name ?? "Cliente a definir";
        const GREEN = "bg-[#0A8545]", GREY = "bg-[#5B6B80]";
        if (scheduled) {
          return (
            <SwipeRow key={v.id}
              right={{ label: "Começar", icon: <Play size={24} aria-hidden />, className: GREEN }}
              left={{ label: "Cancelar", icon: <Trash2 size={24} aria-hidden />, className: GREY }}
              onRight={() => { startVisit(v.id); router.push(`/visitas/${v.id}`); }}
              onLeft={() => setAskDelete({ id: v.id, name, scheduled: true })}
            >{card}</SwipeRow>
          );
        }
        if (!v.quoteId) {
          return (
            <SwipeRow key={v.id}
              right={{ label: "Orçamento", icon: <FilePlus2 size={24} aria-hidden />, className: GREEN }}
              left={{ label: "Apagar", icon: <Trash2 size={24} aria-hidden />, className: GREY }}
              onRight={() => router.push(`/orcamentos/novo?visita=${v.id}`)}
              onLeft={() => setAskDelete({ id: v.id, name, scheduled: false })}
            >{card}</SwipeRow>
          );
        }
        return (
          <SwipeRow key={v.id}
            right={{ label: "Ver orçamento", icon: <FileText size={24} aria-hidden />, className: "bg-brand" }}
            onRight={() => router.push(`/orcamentos/${v.quoteId}`)}
          >{card}</SwipeRow>
        );
      })}
      </div>
      {filter !== "quoted" && counts.quoted > 0 ? (
        <Button variant="ghost" size="sm" icon={FileText} onClick={() => setPicked("quoted")}>Visitas com orçamento feito ({counts.quoted})</Button>
      ) : null}
      {db.visits.length > 0 ? <InstallBanner /> : null}
      <ConfirmDialog
        open={!!askDelete}
        title={askDelete?.scheduled ? "Cancelar esta visita?" : "Apagar esta visita?"}
        text={askDelete ? (askDelete.scheduled ? `A visita agendada de ${askDelete.name} será apagada.` : `A visita de ${askDelete.name} será apagada, com as fotos, áudios e medidas dela. Isso não pode ser desfeito.`) : ""}
        confirmLabel={askDelete?.scheduled ? "Sim, cancelar" : "Sim, apagar"}
        onConfirm={() => { if (askDelete) void deleteVisit(askDelete.id, db.visits); setAskDelete(null); }}
        onCancel={() => setAskDelete(null)}
      />
      </div>
    </Screen>
  );
}
