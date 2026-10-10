"use client";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cloudEnabled } from "@/modules/auth";
import { fmtClock, useRecorder } from "@/modules/audio";
import { dictationFailureText, MAX_DICTATION_SECONDS, transcribeDictation } from "@/modules/dictation";

/**
 * Botão de ditar: toque para falar, toque de novo para parar. O que foi dito vira texto e chega em `onText`.
 * Só aparece com conta (precisa de internet e do servidor). `round` = só o círculo do microfone (para dentro de cartões).
 */
export function DictateButton({ onText, round = false, label = "Ditar" }: { onText: (text: string) => void; round?: boolean; label?: string }) {
  const { state, seconds, start, stop } = useRecorder();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const auto = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => () => { if (auto.current) clearTimeout(auto.current); }, []);

  const finish = async () => {
    if (auto.current) clearTimeout(auto.current);
    const out = await stop();
    if (!out) return;
    setBusy(true);
    try {
      const text = await transcribeDictation(out.blob);
      if (text) onText(text);
      else setMsg("Não entendi nada. Fale mais perto do celular e tente de novo.");
    } catch (e) {
      setMsg(dictationFailureText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { finishRef.current = finish; });

  const toggle = async () => {
    setMsg("");
    if (state === "recording") return finish();
    await start();
    auto.current = setTimeout(() => void finishRef.current(), MAX_DICTATION_SECONDS * 1000);
  };

  if (!cloudEnabled || state === "unsupported") return null;
  const recording = state === "recording";
  const text = busy ? "Escrevendo…" : recording ? `Parar (${fmtClock(seconds)})` : label;
  const Icon = busy ? Loader2 : recording ? Square : Mic;
  const cls = recording ? "bg-err text-white" : "bg-brand-soft text-brand";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-label={recording ? "Parar de ditar e escrever o texto" : busy ? "Escrevendo o que você falou" : "Ditar por voz"}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full font-display font-semibold ${cls} ${round ? "h-12 w-12 !p-0" : "px-4"}`}
      >
        <Icon size={22} strokeWidth={2.4} aria-hidden className={busy ? "animate-spin" : ""} />
        {round && !recording ? null : <span className="text-[17px]">{text}</span>}
      </button>
      {state === "denied" ? <p role="alert" className="max-w-[16rem] text-right text-base text-err">O celular não deixou o app usar o microfone. Libere nas configurações do navegador.</p> : null}
      {msg ? <p role="alert" className="max-w-[16rem] text-right text-base text-err">{msg}</p> : null}
    </div>
  );
}
