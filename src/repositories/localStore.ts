/**
 * Armazenamento local (navegador). Trocar por Supabase = reescrever só este arquivo
 * (mesma interface: ler, gravar, assinar mudanças).
 */
const KEY = "pintorpro:v1";
const listeners = new Set<() => void>();

export const readRaw = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const writeRaw = (raw: string): void => {
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* modo privado / cheio: ignora */
  }
  listeners.forEach((l) => l());
};

export const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
};
