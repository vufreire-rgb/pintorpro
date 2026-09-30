import { clearCurrent, clearLegacy, onWrite, readLegacy, readRaw, setNamespace, writeRaw } from "@/repositories/localStore";
import { pull, push } from "@/repositories/cloudStore";

export type SyncStatus = "idle" | "saving" | "error";
let status: SyncStatus = "idle";
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l());
};
export const getSyncStatus = (): SyncStatus => status;
export const subscribeSync = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let stopWatching: (() => void) | null = null;

async function flush(): Promise<void> {
  if (!userId) return;
  const raw = readRaw();
  if (!raw) return;
  setStatus("saving");
  try {
    await push(userId, raw);
    setStatus("idle");
  } catch {
    setStatus("error");
    timer = setTimeout(flush, 15000); // tenta de novo
  }
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 800);
};

/** Chamado após o login: a nuvem manda; se a conta é nova, sobe o que já existia neste aparelho. */
export async function startSync(uid: string): Promise<void> {
  userId = uid;
  setNamespace(uid);
  const remote = await pull(uid);
  if (remote) {
    writeRaw(remote.data, { silent: true });
  } else {
    const seed = readRaw() ?? readLegacy();
    if (seed) {
      writeRaw(seed, { silent: true });
      await push(uid, seed);
    }
  }
  clearLegacy(); // dados do modo local já foram adotados por esta conta
  stopWatching?.();
  stopWatching = onWrite(schedule);
}

/** Envia o que estiver pendente antes de sair. */
export async function stopSync(): Promise<void> {
  if (timer) clearTimeout(timer);
  stopWatching?.();
  stopWatching = null;
  if (userId) await flush();
  userId = null;
  clearCurrent();
  setNamespace(null);
  setStatus("idle");
}
