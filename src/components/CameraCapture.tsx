"use client";
import { useEffect, useRef, useState } from "react";
import { Chip } from "./ui";

/**
 * Câmera dentro do app: o pintor tira várias fotos seguidas sem sair da tela
 * e marca o ambiente de cada uma na hora. `onShot` guarda a foto.
 */
export function CameraCapture({ rooms, onShot, onClose }: { rooms: string[]; onShot: (file: File, room: string) => Promise<void>; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        setReady(true);
      })
      .catch(() => alive && setError("Não consegui abrir a câmera. Permita o acesso à câmera ou use \"Escolher da galeria\"."));
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      if (blob) {
        await onShot(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }), room);
        setCount((c) => c + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 120);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Câmera">
      <div className="flex items-center justify-between p-4">
        <span className="text-lg font-semibold" data-testid="camera-count">{count} {count === 1 ? "foto" : "fotos"}</span>
        <button onClick={onClose} className="min-h-12 rounded-full bg-white px-6 text-lg font-bold text-black">Concluir</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {error ? <p className="p-6 text-center text-lg">{error}</p> : <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />}
        {flash ? <div className="absolute inset-0 bg-white/70" /> : null}
      </div>
      <div className="flex flex-col gap-4 p-4 pb-8">
        {rooms.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={room === ""} onClick={() => setRoom("")}>Sem ambiente</Chip>
            {rooms.map((r) => <Chip key={r} active={room === r} onClick={() => setRoom(r)}>{r}</Chip>)}
          </div>
        ) : null}
        <button
          onClick={shoot}
          disabled={!ready || busy}
          aria-label="Tirar foto"
          className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
