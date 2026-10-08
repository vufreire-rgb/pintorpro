"use client";
import { useEffect } from "react";

/** Aviso curto embaixo da tela, com "Desfazer". Some sozinho. */
export function UndoBar({ message, onUndo, onDone, ms = 6000 }: { message: string; onUndo: () => void; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, ms, onDone]);
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
      <span className="min-w-0 text-base font-semibold">{message}</span>
      <button type="button" onClick={onUndo} className="shrink-0 rounded-xl px-3 py-2 text-base font-bold text-white underline">Desfazer</button>
    </div>
  );
}
