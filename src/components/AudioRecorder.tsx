"use client";
import { useRef, useState } from "react";
import { cloudEnabled } from "@/modules/auth";
import { fmtClock, useRecorder } from "@/modules/audio";
import { useFileUrl } from "@/modules/photos";
import { addVisitAudio, removeVisitAudio, setRecordingConsent } from "@/modules/visits";
import type { AudioMarker, AudioNote } from "@/modules/types";
import { fmtDate } from "@/shared/format";
import { Button, CardTitle, ConfirmDialog } from "./ui";
import { Mic, MapPin, MessageCircle, Square, Star, TriangleAlert, X, type LucideIcon } from "lucide-react";

/** Marcas rápidas durante a gravação. */
export const MARKERS = ["Medida", "Problema", "Importante", "Pedido do cliente"] as const;
const MARKER_ICON: Record<string, LucideIcon> = { Medida: MapPin, Problema: TriangleAlert, Importante: Star, "Pedido do cliente": MessageCircle };
/** Marcas antigas foram guardadas com emoji na frente: tira o emoji e fica só a palavra. */
const cleanLabel = (s: string): string => s.replace(/^[^\p{L}]+/u, "").trim();

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
        <span className="text-lg font-bold">Áudio {index + 1} · {fmtClock(note.seconds)} · {fmtDate(note.createdAt)}</span>
        <button onClick={onRemove} aria-label="Apagar áudio" className="grid h-12 w-12 place-items-center rounded-full bg-slate-100"><X size={20} strokeWidth={2.4} aria-hidden /></button>
      </div>
      {url ? (
        <>
          <audio ref={audio} controls src={url} className="w-full" onError={() => setFailed(true)} />
          {failed ? <p className="text-base text-[#8A4B00]">Este aparelho não consegue tocar este áudio (gravado em outro formato). Grave de novo.</p> : null}
        </>
      ) : <span className="text-base text-support">Carregando áudio… (se não aparecer, ele não está neste aparelho)</span>}
      {note.markers?.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Marcas do áudio">
          {note.markers.map((m, i) => (
            <button key={i} onClick={() => jump(m.t)} className="min-h-12 rounded-full border-2 border-field bg-white px-4 text-base font-bold">
              {fmtClock(m.t)} {cleanLabel(m.label)}
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
      <CardTitle icon={Mic}>Áudio ({audios.length})</CardTitle>
      {audios.map((a, i) => <Player key={a.id} note={a} index={i} onRemove={() => removeVisitAudio(visitId, a.id)} />)}
      {state === "recording" ? (
        <>
          <Button icon={Square} onClick={finish} disabled={saving}>Parar e guardar · {fmtClock(seconds)}</Button>
          <div className="grid grid-cols-2 gap-2" aria-label="Marcar momento">
            {MARKERS.map((label) => {
              const Icon = MARKER_ICON[label]!;
              return (
                <button
                  key={label}
                  onClick={() => setMarkers((m) => [...m, { t: seconds, label }])}
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 border-field bg-white px-2 text-base font-bold text-ink active:bg-brand-soft"
                >
                  <Icon size={20} strokeWidth={2.2} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
          {markers.length > 0 ? <p className="text-base text-support">{markers.length} {markers.length === 1 ? "marca" : "marcas"} neste áudio.</p> : <p className="text-base text-support">Toque numa marca para guardar o momento exato.</p>}
        </>
      ) : (
        <Button variant="ghost" icon={Mic} onClick={press} disabled={saving || state === "unsupported"}>Gravar áudio</Button>
      )}
      {state === "denied" ? <p className="text-base text-err">Sem acesso ao microfone. Permita o microfone nas configurações do navegador e tente de novo.</p> : null}
      {state === "unsupported" ? <p className="text-base text-err">Este navegador não consegue gravar áudio.</p> : null}
      <p className="text-base text-support">{cloudEnabled ? "Os áudios ficam guardados na sua conta." : "Os áudios ficam guardados neste aparelho."}</p>
      <ConfirmDialog
        open={asking}
        title="Você avisou o cliente?"
        text="Antes de gravar a conversa, avise o cliente. Ex.: “Vou gravar a conversa para não esquecer nada do que combinarmos.”"
        confirmLabel="Sim, avisei. Gravar"
        confirmVariant="primary"
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
