"use client";
import { deleteAccountOnServer, signOut } from "@/repositories/cloudStore";
import { clearAllFiles } from "@/repositories/fileStore";
import { readRaw, wipeAllAccountData } from "@/repositories/localStore";
import { flushPendingUploads, pendingUploadCount } from "./photos";
import { abandonSync, hasUnsentChanges, syncNow } from "./sync";

export const ACCOUNT_DELETED_FLAG = "pintorpro:account-deleted";
export const DELETE_WORD = "EXCLUIR";

/** A pessoa digitou a palavra de confirmação (sem diferenciar maiúsculas e espaços nas pontas)? */
export const confirmsDeletion = (typed: string): boolean => typed.trim().toUpperCase() === DELETE_WORD;

/**
 * Exclui a conta de verdade: servidor (usuário, dados e arquivos) e depois este aparelho.
 * Só mexe no aparelho se o servidor confirmou, para não deixar a pessoa sem dados e com a conta ainda viva.
 */
export async function deleteMyAccount(): Promise<"ok" | "error"> {
  try {
    await deleteAccountOnServer();
  } catch {
    return "error";
  }
  abandonSync();
  wipeAllAccountData();
  await clearAllFiles().catch(() => undefined);
  try {
    sessionStorage.setItem(ACCOUNT_DELETED_FLAG, "1");
  } catch {
    /* ignora */
  }
  await signOut().catch(() => undefined);
  return "ok";
}

/** Tenta enviar o que falta e diz se sobrou algo que só existe neste aparelho (sair agora o apagaria). */
export async function prepareLogout(): Promise<"clean" | "unsent"> {
  await syncNow().catch(() => undefined);
  await flushPendingUploads().catch(() => undefined);
  return hasUnsentChanges() || pendingUploadCount() > 0 ? "unsent" : "clean";
}

/** Sair da conta e apagar deste aparelho os dados e as fotos (eles continuam na conta). */
export async function signOutAndWipe(): Promise<void> {
  await signOut().catch(() => undefined);
  abandonSync();
  wipeAllAccountData();
  await clearAllFiles().catch(() => undefined);
}

/** Baixa um arquivo com os dados da conta (clientes, visitas, orçamentos, obras…). Fotos e áudios não vão neste arquivo. */
export function downloadMyData(): boolean {
  const raw = readRaw();
  if (!raw) return false;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  const blob = new Blob([JSON.stringify({ app: "Medde", exportadoEm: new Date().toISOString(), dados: data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medde-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Lê (e apaga) o aviso "conta excluída" mostrado na tela de login depois da exclusão. */
export function takeAccountDeletedNotice(): boolean {
  try {
    const v = sessionStorage.getItem(ACCOUNT_DELETED_FLAG) === "1";
    if (v) sessionStorage.removeItem(ACCOUNT_DELETED_FLAG);
    return v;
  } catch {
    return false;
  }
}
