"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "denied" | "unsupported";

// MP4/AAC toca em iPhone e Android. WebM/Ogg só tocam em parte dos aparelhos, então ficam como último recurso.
const PREFERRED = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
const pickMime = (): string | undefined =>
  typeof MediaRecorder === "undefined" ? undefined : PREFERRED.find((m) => MediaRecorder.isTypeSupported(m));

// MP4 só vale se for AAC: o Chrome do Android às vezes grava MP4 com Opus, que o iPhone pode não tocar.
const isUniversal = (type: string) => /wav|mpeg|aac|mp4a/i.test(type) || (/mp4/i.test(type) && !/opus/i.test(type));

/** Converte qualquer áudio que este aparelho consiga ouvir para WAV mono 16 kHz, que toca em todos os aparelhos. */
export async function toWav(blob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);

    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const text = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    text(0, "RIFF");
    out.setUint32(4, 36 + pcm.length * 2, true);
    text(8, "WAVEfmt ");
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); // PCM
    out.setUint16(22, 1, true); // mono
    out.setUint32(24, rate, true);
    out.setUint32(28, rate * 2, true);
    out.setUint16(32, 2, true);
    out.setUint16(34, 16, true);
    text(36, "data");
    out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    return new Blob([out], { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}

/** Garante um formato que toque em qualquer celular; se a conversão falhar, mantém o original. */
export async function normalizeAudio(blob: Blob): Promise<Blob> {
  if (isUniversal(blob.type)) return blob;
  try {
    return await toWav(blob);
  } catch {
    return blob;
  }
}

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
          void normalizeAudio(new Blob(chunks.current, { type })).then((blob) => resolve({ blob, seconds: secs }));
        };
        r.stop();
      }),
    [cleanup],
  );

  return { state, seconds, start, stop };
}

export const fmtClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Extensão do arquivo para download, conforme o formato gravado. */
export const audioExt = (mime: string): string => (/wav/i.test(mime) ? "wav" : /mp4|aac/i.test(mime) ? "m4a" : /ogg/i.test(mime) ? "ogg" : "webm");
