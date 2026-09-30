/**
 * Armazenamento local (navegador). Serve como cache rápido/offline; quando há login,
 * cada conta usa uma chave própria e o módulo de sincronização espelha na nuvem.
 */
const LEGACY_KEY = "pintorpro:v1";
let key = LEGACY_KEY;
const listeners = new Set<() => void>();
const writeListeners = new Set<() => void>();

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback; // modo privado / cheio
  }
};

export const readRaw = (): string | null => safe(() => localStorage.getItem(key), null);

/** `silent`: grava sem disparar a sincronização (usado ao baixar da nuvem). */
export const writeRaw = (raw: string, opts?: { silent?: boolean }): void => {
  safe(() => localStorage.setItem(key, raw), undefined);
  listeners.forEach((l) => l());
  if (!opts?.silent) writeListeners.forEach((l) => l());
};

export const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
};

export const onWrite = (l: () => void): (() => void) => {
  writeListeners.add(l);
  return () => writeListeners.delete(l);
};

/** Cada conta logada usa a sua chave (evita misturar contas no mesmo aparelho). */
export const setNamespace = (id: string | null): void => {
  key = id ? `${LEGACY_KEY}:${id}` : LEGACY_KEY;
  listeners.forEach((l) => l());
};

export const readLegacy = (): string | null => safe(() => localStorage.getItem(LEGACY_KEY), null);
export const clearLegacy = (): void => safe(() => localStorage.removeItem(LEGACY_KEY), undefined);
export const clearCurrent = (): void => {
  safe(() => localStorage.removeItem(key), undefined);
  listeners.forEach((l) => l());
};
