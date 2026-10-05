"use client";
import { useMarkedUrl, usePhotoUrl } from "@/modules/photos";
import type { PhotoMark } from "@/modules/types";

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
        <div className="grid h-full place-items-center p-2 text-center text-xs text-slate-500">Foto não está neste aparelho</div>
      )}
      {onToggle ? (
        <button
          onClick={onToggle}
          aria-label={selected ? "Tirar do PDF" : "Pôr no PDF"}
          className={`absolute bottom-1 left-1 rounded-full px-3 py-2 text-xs font-bold ${selected ? "bg-accent-dark text-white" : "bg-black/60 text-white"}`}
        >
          {selected ? "✓ No PDF" : "+ PDF"}
        </button>
      ) : null}
      {onMark ? (
        <button onClick={onMark} aria-label="Marcar a foto" className="absolute left-1 top-1 grid h-9 min-w-9 place-items-center rounded-full bg-black/60 px-2 text-sm font-bold text-white">
          ✏️{marks?.length ? ` ${marks.length}` : ""}
        </button>
      ) : null}
      {onRemove ? (
        <button onClick={onRemove} aria-label="Remover foto" className="absolute right-1 top-1 h-9 w-9 rounded-full bg-black/60 text-white">✕</button>
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
