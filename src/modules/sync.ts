import { clearCurrent, clearLegacy, getMeta, onWrite, readLegacy, readRaw, saveBackup, setMeta, setNamespace, writeRaw } from "@/repositories/localStore";
import { pull, push } from "@/repositories/cloudStore";
import { setUserId } from "./session";

/**
 * Regra de ouro: NUNCA enviar para a nuvem antes de ter conseguido ler a nuvem.
 * Assim um aparelho novo (ou uma falha de internet) jamais sobrescreve os dados da conta com um documento vazio.
 */
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

type Remote = { data: string; updatedAt: string };

let userId: string | null = null;
let synced = false; // já lemos a nuvem com sucesso nesta sessão?
let timer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatching: (() => void) | null = null;
let starting: Promise<void> | null = null;
let startedFor: string | null = null;

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

async function pushNow(uid: string, raw: string): Promise<void> {
  const at = await push(uid, raw);
  setMeta("synced", at);
  setMeta("dirty", "0");
}

async function flush(): Promise<void> {
  if (!userId || !synced) return;
  const raw = readRaw();
  if (!raw) return;
  setStatus("saving");
  try {
    await pushNow(userId, raw);
    setStatus("idle");
  } catch {
    setStatus("error");
    timer = setTimeout(flush, 15000);
  }
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 800);
};

const onLocalWrite = () => {
  setMeta("dirty", "1");
  schedule();
};

/** Junta o que está neste aparelho com o que está na nuvem, sem perder nada. */
async function reconcile(uid: string, remote: Remote | null): Promise<void> {
  const local = readRaw();
  const dirty = getMeta("dirty") === "1";
  const lastSynced = ms(getMeta("synced"));

  if (!remote) {
    // Conta sem dados na nuvem: sobe o que existir neste aparelho (inclusive do modo local antigo).
    const seed = local ?? readLegacy();
    if (seed) {
      writeRaw(seed, { silent: true });
      await pushNow(uid, seed);
    }
  } else if (local && dirty && lastSynced && ms(remote.updatedAt) <= lastSynced) {
    // Alterações feitas offline e a nuvem não mudou desde então: o local é mais novo.
    await pushNow(uid, local);
  } else {
    // A nuvem manda. Se havia alterações locais não enviadas, guarda uma cópia de segurança.
    if (local && dirty && local !== remote.data) saveBackup(local);
    writeRaw(remote.data, { silent: true });
    setMeta("synced", remote.updatedAt);
    setMeta("dirty", "0");
  }
  clearLegacy();
  synced = true;
}

function scheduleRetry(uid: string): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(async () => {
    if (userId !== uid || synced) return;
    try {
      await reconcile(uid, await pull(uid));
      setStatus("idle");
      if (getMeta("dirty") === "1") schedule();
    } catch {
      scheduleRetry(uid);
    }
  }, 15000);
}

async function run(uid: string): Promise<void> {
  userId = uid;
  synced = false;
  setUserId(uid);
  setNamespace(uid);

  let remote: Remote | null | undefined;
  try {
    remote = await pull(uid);
  } catch {
    remote = undefined; // não conseguimos ler a nuvem
  }

  if (remote === undefined) {
    // Sem cópia local não há o que mostrar: melhor parar e pedir para tentar de novo do que mostrar uma conta "vazia".
    if (!readRaw()) throw new Error("Não foi possível carregar os dados da conta.");
    setStatus("error");
    scheduleRetry(uid); // segue com o cache local, mas sem enviar nada até conseguir ler a nuvem
  } else {
    await reconcile(uid, remote);
  }
  stopWatching?.();
  stopWatching = onWrite(onLocalWrite);
}

/** Chamado após o login. Chamadas repetidas para a mesma conta compartilham a mesma operação. */
export function startSync(uid: string): Promise<void> {
  if (starting && startedFor === uid) return starting;
  startedFor = uid;
  starting = run(uid).catch((e) => {
    starting = null;
    startedFor = null;
    userId = null;
    setUserId(null);
    throw e;
  });
  return starting;
}

/** Envia o que estiver pendente antes de sair. */
export async function stopSync(): Promise<void> {
  if (timer) clearTimeout(timer);
  if (retryTimer) clearTimeout(retryTimer);
  stopWatching?.();
  stopWatching = null;
  if (userId && synced && getMeta("dirty") === "1") await flush();
  userId = null;
  synced = false;
  starting = null;
  startedFor = null;
  setUserId(null);
  clearCurrent();
  setNamespace(null);
  setStatus("idle");
}
