"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "denied" | "unsupported";

const PREFERRED = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"];
const pickMime = (): string | undefined =>
  typeof MediaRecorder === "undefined" ? undefined : PREFERRED.find((m) => MediaRecorder.isTypeSupported(m));

/** Gravador de áudio do navegador (microfone do celular). */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(
    typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia ? "unsupported" : "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]); // ao sair da tela, solta o microfone

  const start = useCallback(async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("denied");
      return;
    }
    chunks.current = [];
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    r.start(1000);
    rec.current = r;
    startedAt.current = Date.now();
    setSeconds(0);
    timer.current = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    setState("recording");
  }, []);

  /** Para e devolve o áudio gravado (ou null se não havia gravação). */
  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; seconds: number } | null>((resolve) => {
        const r = rec.current;
        if (!r || r.state === "inactive") return resolve(null);
        r.onstop = () => {
          const type = r.mimeType || chunks.current[0]?.type || "audio/webm";
          const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
          cleanup();
          setState("idle");
          resolve({ blob: new Blob(chunks.current, { type }), seconds: secs });
        };
        r.stop();
      }),
    [cleanup],
  );

  return { state, seconds, start, stop };
}

export const fmtClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
