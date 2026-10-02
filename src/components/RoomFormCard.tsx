"use client";
import { WALL_CONDITIONS } from "@/modules/catalog";
import { isRoomValid, type RoomForm } from "@/modules/rooms";
import { Button, Card, Chip, Field, NumberInput, Stepper, TextInput } from "./ui";

/** Formulário de um ambiente (medidas, estado da parede, portas e janelas). Usado na visita e no orçamento. */
export function RoomFormCard({ form, onChange, onAdd, title }: { form: RoomForm; onChange: (f: RoomForm) => void; onAdd: () => void; title: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <b>{title}</b>
      <Field label="Nome"><TextInput placeholder="Ex.: Sala" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Comprim. (m)"><NumberInput value={form.lengthM} onChange={(n) => onChange({ ...form, lengthM: n })} /></Field>
        <Field label="Largura (m)"><NumberInput value={form.widthM} onChange={(n) => onChange({ ...form, widthM: n })} /></Field>
        <Field label="Altura (m)"><NumberInput value={form.heightM} onChange={(n) => onChange({ ...form, heightM: n })} /></Field>
      </div>
      <div>
        <p className="mb-2 font-medium">Como estão as paredes?</p>
        <div className="flex flex-wrap gap-2">
          {WALL_CONDITIONS.map((w) => <Chip key={w.id} active={form.condition === w.id} onClick={() => onChange({ ...form, condition: w.id })}>{w.label}</Chip>)}
        </div>
      </div>
      <div className="flex items-center justify-between"><span>Portas</span><Stepper value={form.doors} onChange={(n) => onChange({ ...form, doors: n })} /></div>
      <div className="flex items-center justify-between"><span>Janelas</span><Stepper value={form.windows} onChange={(n) => onChange({ ...form, windows: n })} /></div>
      <Button variant="ghost" disabled={!isRoomValid(form)} onClick={onAdd}>+ Adicionar ambiente</Button>
    </Card>
  );
}
