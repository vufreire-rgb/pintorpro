"use client";
import { audioExt, fmtClock } from "@/modules/audio";
import { useFileUrl } from "@/modules/photos";
import type { AudioNote } from "@/modules/types";

function Item({ note, index }: { note: AudioNote; index: number }) {
  const url = useFileUrl(note.id);
  return (
    <div className="mt-2">
      <div className="text-sm">Áudio {index + 1} · {fmtClock(note.seconds)}</div>
      {url ? (
        <>
          <audio controls src={url} className="w-full" />
          <a href={url} download={`audio-${index + 1}.${audioExt(note.mime)}`} className="text-sm text-blue-700 underline">Baixar áudio</a>
        </>
      ) : <span className="text-sm text-slate-500">Carregando áudio…</span>}
    </div>
  );
}

export const AudioList = ({ audios }: { audios: AudioNote[] }) => (
  <>{audios.map((a, i) => <Item key={a.id} note={a} index={i} />)}</>
);
