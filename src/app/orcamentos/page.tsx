"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, CardTitle, Chip, Field, LinkButton, Loading, Screen, TextInput } from "@/components/ui";
import { AlarmClock, Eye, Inbox, Mic, Plus } from "lucide-react";
import { DAY_SHORT, DEFAULT_REMINDER, isValidTime, reminderLabel, type ReviewReminder } from "@/modules/reminder";
import { saveCompany } from "@/modules/settings";
import { downloadReviewIcs } from "@/modules/share";
import { isExpired } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import { usePendingVoice } from "@/modules/voice";
import { agoLabel, useQuoteLinks } from "@/modules/quoteLinks";
import { useRequests } from "@/modules/publicPage";
import { cloudEnabled } from "@/modules/auth";
import type { QuoteStatus } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";

export const STATUS_LABEL: Record<QuoteStatus, string> = { open: "Aberto", won: "Fechado", lost: "Perdido" };

function ReminderCard({ saved, onSave, onClose }: { saved?: ReviewReminder; onSave: (r: ReviewReminder) => void; onClose: () => void }) {
  const [r, setR] = useState<ReviewReminder>(saved ?? DEFAULT_REMINDER);
  const toggle = (d: number) => setR({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] });
  return (
    <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
      <CardTitle icon={AlarmClock}>Hora de revisar</CardTitle>
      {saved ? <p className="text-base font-bold text-brand">Lembrete atual: {reminderLabel(saved)}</p> : null}
      <p className="text-base text-support">O celular apita no horário, mesmo com o app fechado, para você ver quem ainda não respondeu.</p>
      <Field label="Que horas?"><TextInput type="time" value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">
        <Chip active={r.days.length === 7} onClick={() => setR({ ...r, days: [0, 1, 2, 3, 4, 5, 6] })}>Todo dia</Chip>
        <Chip active={r.days.join() === "1,2,3,4,5"} onClick={() => setR({ ...r, days: [1, 2, 3, 4, 5] })}>Seg a Sex</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAY_SHORT.map((n, d) => <Chip key={n} active={r.days.includes(d)} onClick={() => toggle(d)}>{n}</Chip>)}
      </div>
      <Button disabled={!isValidTime(r.time) || r.days.length === 0} onClick={() => { const v = { ...r, days: [...r.days].sort((a, b) => a - b) }; onSave(v); downloadReviewIcs(v); onClose(); }}>Salvar no calendário do celular</Button>
      <p className="text-base text-support">Vai baixar um arquivo: abra-o e toque em adicionar ao calendário. Se mudar o horário depois, apague o lembrete antigo no calendário.</p>
      <Button variant="ghost" onClick={onClose}>Fechar</Button>
    </Card>
  );
}

const TABS: QuoteStatus[] = ["open", "won", "lost"];

export default function Orcamentos() {
  const db = useAppDb();
  const voicePending = usePendingVoice().length;
  const { links } = useQuoteLinks();
  const newRequests = useRequests().requests.filter((r) => r.status === "new").length;
  const [tab, setTab] = useState<QuoteStatus>("open");
  const [remOpen, setRemOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  if (!db) return <Loading />;
  const list = db.quotes.filter((q) => q.status === tab);
  return (
    <Screen title="Orçamentos" nav>
      <div
        className="flex flex-col gap-4"
        onTouchStart={(e) => { touchX.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          const i = TABS.indexOf(tab);
          if (dx < -60 && i < TABS.length - 1) setTab(TABS[i + 1]!);
          if (dx > 60 && i > 0) setTab(TABS[i - 1]!);
        }}
      >
      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/orcamentos/novo" icon={Plus} className="!px-3 !text-lg">Novo orçamento</LinkButton>
        <Button variant="ghost" icon={AlarmClock} className="!px-3 !text-lg" onClick={() => setRemOpen((o) => !o)}>Lembrete</Button>
        <LinkButton href="/orcamentos/voz" icon={Mic} variant="ghost" className="col-span-2 !px-3 !text-lg">Ditar orçamento por voz{voicePending > 0 ? ` (${voicePending} aguardando)` : ""}</LinkButton>
        {cloudEnabled ? <LinkButton href="/pedidos" icon={Inbox} variant="ghost" className="col-span-2 !px-3 !text-lg">Pedidos de clientes{newRequests > 0 ? ` (${newRequests} ${newRequests === 1 ? "novo" : "novos"})` : ""}</LinkButton> : null}
      </div>
      {remOpen ? <ReminderCard saved={db.company?.reviewReminder} onSave={(rr) => saveCompany({ ...db.company!, reviewReminder: rr })} onClose={() => setRemOpen(false)} /> : null}
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`min-h-12 rounded-xl px-1 text-base font-bold leading-tight ${tab === s ? "bg-brand text-white" : "text-ink"}`}
          >
            {STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})
          </button>
        ))}
      </div>
      {tab === "open" && list.length > 0 ? <div className="text-lg text-support">Total em aberto: <b>{formatBRL(list.reduce((s, q) => s + q.result.totals.totalCents, 0))}</b></div> : null}
      {list.length === 0 ? <p className="text-lg text-support">Nada por aqui.</p> : null}
      {list.map((q) => (
        <Link key={q.id} href={`/orcamentos/${q.id}`}>
          <Card>
            <div className="flex justify-between gap-2 text-lg"><b className="min-w-0 truncate">Nº {q.number} · {db.clients.find((c) => c.id === q.clientId)?.name}</b><b className="font-display">{formatBRL(q.result.totals.totalCents)}</b></div>
            <div className="mt-1 flex items-center gap-2 text-base text-support">{fmtDate(q.createdAt)}{isExpired(q) ? <Badge tone="warn">Vencido (7 dias)</Badge> : null}{links[q.id]?.lastViewedAt ? <span className="inline-flex items-center gap-1 font-semibold text-brand"><Eye size={16} aria-hidden />Visto {agoLabel(links[q.id]!.lastViewedAt!)}</span> : null}</div>
          </Card>
        </Link>
      ))}
      </div>
    </Screen>
  );
}
