"use client";
import { usePhotoUrl } from "@/modules/photos";

function Thumb({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const url = usePhotoUrl(id);
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
      {onRemove ? (
        <button onClick={onRemove} aria-label="Remover foto" className="absolute right-1 top-1 h-9 w-9 rounded-full bg-black/60 text-white">✕</button>
      ) : null}
    </div>
  );
}

export function PhotoGrid({ ids, onRemove }: { ids: string[]; onRemove?: (id: string) => void }) {
  if (ids.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {ids.map((id) => <Thumb key={id} id={id} onRemove={onRemove ? () => onRemove(id) : undefined} />)}
    </div>
  );
}
