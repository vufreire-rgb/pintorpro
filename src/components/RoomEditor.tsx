"use client";
import { PAINT_OPTIONS } from "@/modules/catalog";
import { addSurface, legacyToSurfaces, removeSurface, surfacesSummary, type RoomDraft } from "@/modules/rooms";
import type { PaintType, Surface } from "@/modules/types";
import { useState } from "react";
import { Check, Plus, Ruler, X } from "lucide-react";
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
  /** Atalho para ambiente retangular: 3 medidas viram 4 paredes e o teto. Só aparece enquanto nada foi medido. */
  const [quick, setQuick] = useState({ l: 0, w: 0, h: 2.7 });
  const untouched = draft.surfaces.every((s) => !(s.widthM > 0));
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      <Field label="Nome do ambiente"><TextInput placeholder="Ex.: Sala" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} /></Field>
      {untouched ? (
        <details className="group rounded-2xl bg-brand-soft p-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-display text-lg font-semibold text-brand"><Ruler size={22} strokeWidth={2.2} aria-hidden />Atalho: ambiente retangular</summary>
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-base leading-[22px] text-support">Digite 3 medidas e o app preenche as 4 paredes e o teto. Depois você ajusta o que precisar.</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Comprimento (m)"><NumberInput aria-label="Atalho comprimento" value={quick.l} onChange={(n) => setQuick({ ...quick, l: n })} /></Field>
              <Field label="Largura (m)"><NumberInput aria-label="Atalho largura" value={quick.w} onChange={(n) => setQuick({ ...quick, w: n })} /></Field>
              <Field label="Altura (m)"><NumberInput aria-label="Atalho altura" value={quick.h} onChange={(n) => setQuick({ ...quick, h: n })} /></Field>
            </div>
            <Button variant="ghost" disabled={!(quick.l > 0 && quick.w > 0 && quick.h > 0)} onClick={() => onChange({ ...draft, surfaces: legacyToSurfaces(quick.l, quick.w, quick.h) })}>Preencher paredes e teto</Button>
          </div>
        </details>
      ) : null}
      {draft.surfaces.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-xl bg-[#F3F6FA] p-3" data-testid="surface">
          <div className="flex items-center justify-between">
            <b className="text-lg">{s.label}</b>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-[#F3F6FA]" aria-label={`Remover ${s.label}`} onClick={() => onChange({ ...draft, surfaces: removeSurface(draft.surfaces, s.id) })}><X size={20} strokeWidth={2.4} aria-hidden /></button>
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
      {onCancel ? <Button variant="ghost" size="sm" icon={X} onClick={onCancel}>Cancelar</Button> : null}
    </Card>
  );
}
