"use client";
import { useMarkedUrl, usePhotoUrl } from "@/modules/photos";
import type { PhotoMark } from "@/modules/types";
import { Check, Pencil, X } from "lucide-react";

function Thumb({ id, onRemove, selected, onToggle, marks, onMark }: { id: string; onRemove?: () => void; selected?: boolean; onToggle?: () => void; marks?: PhotoMark[]; onMark?: () => void }) {
  const plain = usePhotoUrl(id);
  const marked = useMarkedUrl(id, marks);
  const url = marked ?? plain;
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-200">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Foto da visita" className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="grid h-full place-items-center p-2 text-center text-base text-support">Foto não está neste aparelho</div>
      )}
      {onToggle ? (
        <button
          onClick={onToggle}
          aria-label={selected ? "Tirar do PDF" : "Pôr no PDF"}
          className={`absolute bottom-1 left-1 inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-base font-bold ${selected ? "bg-accent-dark text-white" : "bg-black/70 text-white"}`}
        >
          {selected ? <Check size={18} strokeWidth={3} aria-hidden /> : null}{selected ? "No PDF" : "+ PDF"}
        </button>
      ) : null}
      {onMark ? (
        <button onClick={onMark} aria-label="Marcar a foto" className="absolute left-1 top-1 inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full bg-black/70 px-2 text-base font-bold text-white">
          <Pencil size={20} strokeWidth={2.2} aria-hidden />{marks?.length ? marks.length : ""}
        </button>
      ) : null}
      {onRemove ? (
        <button onClick={onRemove} aria-label="Remover foto" className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white"><X size={20} strokeWidth={2.4} aria-hidden /></button>
      ) : null}
    </div>
  );
}

export function PhotoGrid({ ids, onRemove, selectedIds, onToggle, marksOf, onMark }: { ids: string[]; onRemove?: (id: string) => void; selectedIds?: string[]; onToggle?: (id: string) => void; marksOf?: (id: string) => PhotoMark[] | undefined; onMark?: (id: string) => void }) {
  if (ids.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {ids.map((id) => <Thumb key={id} id={id} onRemove={onRemove ? () => onRemove(id) : undefined} selected={selectedIds?.includes(id)} onToggle={onToggle ? () => onToggle(id) : undefined} marks={marksOf?.(id)} onMark={onMark ? () => onMark(id) : undefined} />)}
    </div>
  );
}
