"use client";
import { fmtClock } from "@/modules/audio";
import { useFileUrl } from "@/modules/photos";
import type { AudioNote } from "@/modules/types";

function Item({ note, index }: { note: AudioNote; index: number }) {
  const url = useFileUrl(note.id);
  return (
    <div className="mt-2">
      <div className="text-sm">Áudio {index + 1} · {fmtClock(note.seconds)}</div>
      {url ? <audio controls src={url} className="w-full" /> : <span className="text-sm text-slate-500">Áudio não está neste aparelho</span>}
    </div>
  );
}

export const AudioList = ({ audios }: { audios: AudioNote[] }) => (
  <>{audios.map((a, i) => <Item key={a.id} note={a} index={i} />)}</>
);
