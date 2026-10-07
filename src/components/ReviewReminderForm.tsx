"use client";
import { useState } from "react";
import { Button, Chip, Field, TextInput } from "./ui";
import { DAY_SHORT, DEFAULT_REMINDER, isValidTime, reminderLabel, type ReviewReminder } from "@/modules/reminder";
import { downloadReviewIcs } from "@/modules/share";

/** Lembrete diário para revisar orçamentos: grava no calendário do celular. Fica em Ajustes. */
export function ReviewReminderForm({ saved, onSave }: { saved?: ReviewReminder; onSave: (r: ReviewReminder) => void }) {
  const [r, setR] = useState<ReviewReminder>(saved ?? DEFAULT_REMINDER);
  const toggle = (d: number) => setR({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] });
  return (
    <div className="flex flex-col gap-3">
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
      <Button disabled={!isValidTime(r.time) || r.days.length === 0} onClick={() => { const v = { ...r, days: [...r.days].sort((a, b) => a - b) }; onSave(v); downloadReviewIcs(v); }}>Salvar no calendário do celular</Button>
      <p className="text-base text-support">Vai baixar um arquivo: abra-o e toque em adicionar ao calendário. Se mudar o horário depois, apague o lembrete antigo no calendário.</p>
    </div>
  );
}
