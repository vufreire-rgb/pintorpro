"use client";
import { useEffect, useState } from "react";

const PREFIX = "pintorpro:dica:";
/** Quantas vezes uma dica aparece antes de sumir. */
export const HINT_MAX = 3;

/** Dica de uso: aparece nas primeiras vezes em que a pessoa vê a tela e depois some. */
export const shouldShowHint = (timesSeen: number): boolean => timesSeen < HINT_MAX;

const read = (key: string): number => {
  try { return Number(localStorage.getItem(PREFIX + key)) || 0; } catch { return 0; }
};

/** `active`: só conta como "visto" quando a dica realmente caberia na tela (ex.: a lista tem itens). */
export function useHint(key: string, active: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const seen = read(key);
    if (!shouldShowHint(seen)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
    try { localStorage.setItem(PREFIX + key, String(seen + 1)); } catch { /* sem armazenamento: a dica só aparece nesta visita */ }
  }, [key, active]);
  return show;
}
