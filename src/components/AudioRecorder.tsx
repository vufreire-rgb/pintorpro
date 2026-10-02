"use client";
import { useRef, useState } from "react";
import { cloudEnabled } from "@/modules/auth";
import { fmtClock, useRecorder } from "@/modules/audio";
import { useFileUrl } from "@/modules/photos";
import { addVisitAudio, removeVisitAudio, setRecordingConsent } from "@/modules/visits";
import type { AudioMarker, AudioNote } from "@/modules/types";
import { fmtDate } from "@/shared/format";
import { Button, ConfirmDialog } from "./ui";

/** Marcas rápidas durante a gravação. */
export const MARKERS = ["📍 Medida", "⚠️ Problema", "⭐ Importante", "💬 Pedido do cliente"] as const;

function Player({ note, index, onRemove }: { note: AudioNote; index: number; onRemove: () => void }) {
  const url = useFileUrl(note.id);
  const audio = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const jump = (t: number) => {
    if (!audio.current) return;
    audio.current.currentTime = t;
    void audio.current.play().catch(() => undefined);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">Áudio {index + 1} · {fmtClock(note.seconds)} · {fmtDate(note.createdAt)}</span>
        <button onClick={onRemove} aria-label="Apagar áudio" className="h-10 w-10 rounded-full bg-slate-200">✕</button>
      </div>
      {url ? (
        <>
          <audio ref={audio} controls src={url} className="w-full" onError={() => setFailed(true)} />
          {failed ? <p className="text-sm text-amber-800">Este aparelho não consegue tocar este áudio (gravado em outro formato). Grave de novo.</p> : null}
        </>
      ) : <span className="text-sm text-slate-500">Carregando áudio… (se não aparecer, ele não está neste aparelho)</span>}
      {note.markers?.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Marcas do áudio">
          {note.markers.map((m, i) => (
            <button key={i} onClick={() => jump(m.t)} className="min-h-10 rounded-full border border-brand/30 bg-white px-3 text-sm">
              {fmtClock(m.t)} {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AudioRecorder({ visitId, audios, consent }: { visitId: string; audios: AudioNote[]; consent: boolean }) {
  const { state, seconds, start, stop } = useRecorder();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);

  const begin = async () => {
    setMarkers([]);
    await start();
  };
  const press = () => (consent ? void begin() : setAsking(true));

  const finish = async () => {
    setSaving(true);
    try {
      const out = await stop();
      if (out) await addVisitAudio(visitId, out.blob, out.seconds, markers);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Áudio ({audios.length})</h2>
      {audios.map((a, i) => <Player key={a.id} note={a} index={i} onRemove={() => removeVisitAudio(visitId, a.id)} />)}
      {state === "recording" ? (
        <>
          <Button variant="danger" onClick={finish} disabled={saving}>⏹ Parar e guardar · {fmtClock(seconds)}</Button>
          <div className="grid grid-cols-2 gap-2" aria-label="Marcar momento">
            {MARKERS.map((label) => (
              <button
                key={label}
                onClick={() => setMarkers((m) => [...m, { t: seconds, label }])}
                className="min-h-12 rounded-xl border border-brand/30 bg-white px-2 text-sm font-semibold active:bg-brand-soft"
              >
                {label}
              </button>
            ))}
          </div>
          {markers.length > 0 ? <p className="text-sm text-slate-600">{markers.length} {markers.length === 1 ? "marca" : "marcas"} neste áudio.</p> : <p className="text-sm text-slate-500">Toque numa marca para guardar o momento exato.</p>}
        </>
      ) : (
        <Button variant="ghost" onClick={press} disabled={saving || state === "unsupported"}>🎙 Gravar áudio</Button>
      )}
      {state === "denied" ? <p className="text-sm text-red-700">Sem acesso ao microfone. Permita o microfone nas configurações do navegador e tente de novo.</p> : null}
      {state === "unsupported" ? <p className="text-sm text-red-700">Este navegador não consegue gravar áudio.</p> : null}
      <p className="text-sm text-slate-500">{cloudEnabled ? "Os áudios ficam guardados na sua conta." : "Os áudios ficam guardados neste aparelho."}</p>
      <ConfirmDialog
        open={asking}
        title="Você avisou o cliente?"
        text="Antes de gravar a conversa, avise o cliente. Ex.: “Vou gravar a conversa para não esquecer nada do que combinarmos.”"
        confirmLabel="Sim, avisei. Gravar"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          setRecordingConsent(visitId);
          void begin();
        }}
      />
    </div>
  );
}
