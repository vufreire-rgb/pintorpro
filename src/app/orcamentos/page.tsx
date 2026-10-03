"use client";
import Link from "next/link";
import { useState } from "react";
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

function ReminderCard({ saved, onSave }: { saved?: ReviewReminder; onSave: (r: ReviewReminder) => void }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<ReviewReminder>(saved ?? DEFAULT_REMINDER);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex min-h-12 items-center justify-between rounded-2xl bg-brand-soft px-4 text-left text-brand">
        <span>⏰ <b>Hora de revisar</b>{saved ? ` · ${reminderLabel(saved)}` : " · toque para criar um lembrete"}</span>
      </button>
    );
  const toggle = (d: number) => setR({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] });
  return (
    <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
      <b>⏰ Hora de revisar</b>
      <p className="text-sm text-slate-600">O celular apita no horário, mesmo com o app fechado, para você ver quem ainda não respondeu.</p>
      <Field label="Que horas?"><TextInput type="time" value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">
        <Chip active={r.days.length === 7} onClick={() => setR({ ...r, days: [0, 1, 2, 3, 4, 5, 6] })}>Todo dia</Chip>
        <Chip active={r.days.join() === "1,2,3,4,5"} onClick={() => setR({ ...r, days: [1, 2, 3, 4, 5] })}>Seg a Sex</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAY_SHORT.map((n, d) => <Chip key={n} active={r.days.includes(d)} onClick={() => toggle(d)}>{n}</Chip>)}
      </div>
      <Button disabled={!isValidTime(r.time) || r.days.length === 0} onClick={() => { const v = { ...r, days: [...r.days].sort((a, b) => a - b) }; onSave(v); downloadReviewIcs(v); setOpen(false); }}>Salvar no calendário do celular</Button>
      <p className="text-sm text-slate-500">Vai baixar um arquivo: abra-o e toque em adicionar ao calendário. Se mudar o horário depois, apague o lembrete antigo no calendário.</p>
      <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
    </Card>
  );
}

export default function Orcamentos() {
  const db = useAppDb();
  const [tab, setTab] = useState<QuoteStatus>("open");
  if (!db) return <Loading />;
  const list = db.quotes.filter((q) => q.status === tab);
  return (
    <Screen title="Orçamentos" nav>
      <ReminderCard saved={db.company?.reviewReminder} onSave={(rr) => saveCompany({ ...db.company!, reviewReminder: rr })} />
      <LinkButton href="/orcamentos/novo">+ NOVO ORÇAMENTO</LinkButton>
      <div className="flex gap-2">
        {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
          <Chip key={s} active={tab === s} onClick={() => setTab(s)}>{STATUS_LABEL[s]} ({db.quotes.filter((q) => q.status === s).length})</Chip>
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
    </Screen>
  );
}
