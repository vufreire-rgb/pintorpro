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

/** Pequenas anotações da conta atual (ex.: "mudou desde o último envio?"). */
export const getMeta = (name: string): string | null => safe(() => localStorage.getItem(`${key}:meta:${name}`), null);
export const setMeta = (name: string, value: string): void => safe(() => localStorage.setItem(`${key}:meta:${name}`, value), undefined);

/** Guarda uma cópia de segurança antes de qualquer substituição de dados locais. */
export const saveBackup = (raw: string): void => safe(() => localStorage.setItem(`${LEGACY_KEY}:backup:${key}`, raw), undefined);

export const readLegacy = (): string | null => safe(() => localStorage.getItem(LEGACY_KEY), null);
export const clearLegacy = (): void => safe(() => localStorage.removeItem(LEGACY_KEY), undefined);
/** Apaga tudo o que o app guardou neste aparelho sobre contas (dados, cópias de segurança, fila de envio). */
export const wipeAllAccountData = (): void =>
  safe(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("pintorpro:v1") || k === "pintorpro:pending-uploads" || k === "pintorpro:voice-pending") localStorage.removeItem(k);
  }, undefined);
export const clearCurrent = (): void => {
  safe(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:meta:dirty`);
    localStorage.removeItem(`${key}:meta:synced`);
  }, undefined);
  listeners.forEach((l) => l());
};
