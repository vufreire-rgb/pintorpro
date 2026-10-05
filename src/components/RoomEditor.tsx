"use client";
import { PAINT_OPTIONS } from "@/modules/catalog";
import { addSurface, removeSurface, surfacesSummary, type RoomDraft } from "@/modules/rooms";
import type { PaintType, Surface } from "@/modules/types";
import { Check, Plus, X } from "lucide-react";
import { Button, Card, CardTitle, Field, inputCls, NumberInput, Stepper, TextInput } from "./ui";

/**
 * Medidas de um ambiente, parede por parede (Parede 1, Parede 2…): largura × altura e o tipo de pintura.
 * Usado na visita e no orçamento, então o que o pintor anota na visita já chega pronto no orçamento.
 */
export function RoomEditor({ draft, onChange, onSave, onCancel, title, saveLabel = "Salvar ambiente" }: { draft: RoomDraft; onChange: (d: RoomDraft) => void; onSave: () => void; onCancel?: () => void; title: string; saveLabel?: string }) {
  const setSurface = (id: string, patch: Partial<Surface>) => onChange({ ...draft, surfaces: draft.surfaces.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const add = (kind: Surface["kind"]) => onChange({ ...draft, surfaces: addSurface(draft.surfaces, kind) });
  const summary = surfacesSummary(draft.surfaces, draft.doors, draft.windows);
  const valid = draft.surfaces.some((s) => s.widthM > 0 && s.heightM > 0);
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      <Field label="Nome do ambiente"><TextInput placeholder="Ex.: Sala" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} /></Field>
      {draft.surfaces.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3" data-testid="surface">
          <div className="flex items-center justify-between">
            <b className="text-lg">{s.label}</b>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-slate-100" aria-label={`Remover ${s.label}`} onClick={() => onChange({ ...draft, surfaces: removeSurface(draft.surfaces, s.id) })}><X size={20} strokeWidth={2.4} aria-hidden /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={s.kind === "wall" ? "Largura (m)" : "Comprimento (m)"}><NumberInput aria-label={`${s.label} largura`} value={s.widthM} onChange={(n) => setSurface(s.id, { widthM: n })} /></Field>
            <Field label={s.kind === "wall" ? "Altura (m)" : "Largura (m)"}><NumberInput aria-label={`${s.label} altura`} value={s.heightM} onChange={(n) => setSurface(s.id, { heightM: n })} /></Field>
          </div>
          <Field label="Tipo de pintura">
            <select className={inputCls} aria-label={`${s.label} tipo de pintura`} value={s.paint} onChange={(e) => setSurface(s.id, { paint: e.target.value as PaintType })}>
              {PAINT_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" icon={Plus} onClick={() => add("wall")}>Parede</Button>
        {!draft.surfaces.some((s) => s.kind === "ceiling") ? <Button variant="ghost" icon={Plus} onClick={() => add("ceiling")}>Teto</Button> : null}
        {!draft.surfaces.some((s) => s.kind === "floor") ? <Button variant="ghost" icon={Plus} onClick={() => add("floor")}>Piso</Button> : null}
      </div>
      <div className="flex items-center justify-between"><span className="text-lg">Portas</span><Stepper value={draft.doors} onChange={(n) => onChange({ ...draft, doors: n })} /></div>
      <div className="flex items-center justify-between"><span className="text-lg">Janelas</span><Stepper value={draft.windows} onChange={(n) => onChange({ ...draft, windows: n })} /></div>
      {summary ? <p className="text-base font-semibold text-brand">{summary}</p> : null}
      <Button icon={Check} disabled={!valid} onClick={onSave}>{saveLabel}</Button>
      {onCancel ? <Button variant="ghost" onClick={onCancel}>Cancelar</Button> : null}
    </Card>
  );
}
