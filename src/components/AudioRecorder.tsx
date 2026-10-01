"use client";
import { useState } from "react";
import { fmtClock, useRecorder } from "@/modules/audio";
import { useFileUrl } from "@/modules/photos";
import { addVisitAudio, removeVisitAudio } from "@/modules/visits";
import type { AudioNote } from "@/modules/types";
import { fmtDate } from "@/shared/format";
import { Button } from "./ui";

function Player({ note, index, onRemove }: { note: AudioNote; index: number; onRemove: () => void }) {
  const url = useFileUrl(note.id);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">Áudio {index + 1} · {fmtClock(note.seconds)} · {fmtDate(note.createdAt)}</span>
        <button onClick={onRemove} aria-label="Apagar áudio" className="h-10 w-10 rounded-full bg-slate-200">✕</button>
      </div>
      {url ? (
        <>
          <audio controls src={url} className="w-full" onError={() => setFailed(true)} />
          {failed ? <p className="text-sm text-amber-800">Este aparelho não consegue tocar este áudio (gravado em outro formato). Grave de novo.</p> : null}
        </>
      ) : <span className="text-sm text-slate-500">Carregando áudio… (se não aparecer, ele não está neste aparelho)</span>}
    </div>
  );
}

export function AudioRecorder({ visitId, audios }: { visitId: string; audios: AudioNote[] }) {
  const { state, seconds, start, stop } = useRecorder();
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      const out = await stop();
      if (out) await addVisitAudio(visitId, out.blob, out.seconds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Áudio ({audios.length})</h2>
      {audios.map((a, i) => <Player key={a.id} note={a} index={i} onRemove={() => removeVisitAudio(visitId, a.id)} />)}
      {state === "recording" ? (
        <Button variant="danger" onClick={finish} disabled={saving}>⏹ Parar e guardar · {fmtClock(seconds)}</Button>
      ) : (
        <Button variant="ghost" onClick={start} disabled={saving || state === "unsupported"}>🎙 Gravar áudio</Button>
      )}
      {state === "denied" ? <p className="text-sm text-red-700">Sem acesso ao microfone. Permita o microfone nas configurações do navegador e tente de novo.</p> : null}
      {state === "unsupported" ? <p className="text-sm text-red-700">Este navegador não consegue gravar áudio.</p> : null}
      <p className="text-sm text-slate-500">Avise o cliente que a conversa está sendo gravada. Os áudios ficam guardados neste aparelho.</p>
    </div>
  );
}
