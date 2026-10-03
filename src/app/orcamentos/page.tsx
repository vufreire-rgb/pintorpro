"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button, Card, Chip, Field, LinkButton, Loading, Screen, TextInput } from "@/components/ui";
import { DAY_SHORT, DEFAULT_REMINDER, isValidTime, reminderLabel, type ReviewReminder } from "@/modules/reminder";
import { saveCompany } from "@/modules/settings";
import { downloadReviewIcs } from "@/modules/share";
import { isExpired } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import type { QuoteStatus } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";

export const STATUS_LABEL: Record<QuoteStatus, string> = { open: "Aberto", won: "Fechado", lost: "Perdido" };

function ReminderCard({ saved, onSave, onClose }: { saved?: ReviewReminder; onSave: (r: ReviewReminder) => void; onClose: () => void }) {
  const [r, setR] = useState<ReviewReminder>(saved ?? DEFAULT_REMINDER);
  const toggle = (d: number) => setR({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] });
  return (
    <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
      <b>⏰ Hora de revisar</b>
      {saved ? <p className="text-sm font-semibold text-brand">Lembrete atual: {reminderLabel(saved)}</p> : null}
      <p className="text-sm text-slate-600">O celular apita no horário, mesmo com o app fechado, para você ver quem ainda não respondeu.</p>
      <Field label="Que horas?"><TextInput type="time" value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">
        <Chip active={r.days.length === 7} onClick={() => setR({ ...r, days: [0, 1, 2, 3, 4, 5, 6] })}>Todo dia</Chip>
        <Chip active={r.days.join() === "1,2,3,4,5"} onClick={() => setR({ ...r, days: [1, 2, 3, 4, 5] })}>Seg a Sex</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAY_SHORT.map((n, d) => <Chip key={n} active={r.days.includes(d)} onClick={() => toggle(d)}>{n}</Chip>)}
      </div>
      <Button disabled={!isValidTime(r.time) || r.days.length === 0} onClick={() => { const v = { ...r, days: [...r.days].sort((a, b) => a - b) }; onSave(v); downloadReviewIcs(v); onClose(); }}>Salvar no calendário do celular</Button>
      <p className="text-sm text-slate-500">Vai baixar um arquivo: abra-o e toque em adicionar ao calendário. Se mudar o horário depois, apague o lembrete antigo no calendário.</p>
      <Button variant="ghost" onClick={onClose}>Fechar</Button>
    </Card>
  );
}

const TABS: QuoteStatus[] = ["open", "won", "lost"];

export default function Orcamentos() {
  const db = useAppDb();
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
        <LinkButton href="/orcamentos/novo" className="!min-h-12 !text-base">+ NOVO ORÇAMENTO</LinkButton>
        <Button variant="ghost" className="!min-h-12 !text-base" onClick={() => setRemOpen((o) => !o)}>⏰ Lembrete</Button>
      </div>
      {remOpen ? <ReminderCard saved={db.company?.reviewReminder} onSave={(rr) => saveCompany({ ...db.company!, reviewReminder: rr })} onClose={() => setRemOpen(false)} /> : null}
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`min-h-12 rounded-xl px-1 text-sm font-semibold leading-tight ${tab === s ? "bg-brand text-white" : "text-slate-700"}`}
          >
            {STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="text-slate-500">Nada por aqui.</p> : null}
      {list.map((q) => (
        <Link key={q.id} href={`/orcamentos/${q.id}`}>
          <Card>
            <div className="flex justify-between"><b>Nº {q.number} · {db.clients.find((c) => c.id === q.clientId)?.name}</b><b>{formatBRL(q.result.totals.totalCents)}</b></div>
            <div className="text-sm text-slate-600">{fmtDate(q.createdAt)}{isExpired(q) ? " · vencido (7 dias)" : ""}</div>
          </Card>
        </Link>
      ))}
      </div>
    </Screen>
  );
}
