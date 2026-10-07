"use client";
import { useSyncExternalStore } from "react";
import { cloudConfigured, getSession, onAuthChange, recoveryLink, requestPasswordReset, resendConfirmation, signIn, signOut, signUp, updatePassword } from "@/repositories/cloudStore";
import { flushPendingUploads } from "./photos";
import { getSyncStatus, startSync, stopSync, subscribeSync } from "./sync";
import { startSubscription, stopSubscription } from "./subscription";

export type AuthState =
  | { status: "loading" }
  | { status: "local" } // sem nuvem configurada: funciona como antes
  | { status: "signedOut" }
  | { status: "error" } // logou, mas não conseguiu carregar os dados da conta
  | { status: "ready"; email: string };

let state: AuthState = cloudConfigured ? { status: "loading" } : { status: "local" };
const listeners = new Set<() => void>();
const set = (s: AuthState) => {
  state = s;
  listeners.forEach((l) => l());
};

export const useAuthState = (): AuthState =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => state,
  );

export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getSyncStatus, () => "idle" as const);

let started = false;
let applyRef: ((s: { user: { id: string; email?: string } } | null) => Promise<void>) | null = null;
if (typeof window !== "undefined") window.addEventListener("online", () => void flushPendingUploads());
/** Idempotente: chamar uma vez na raiz do app. */
export function initAuth(): void {
  if (started || !cloudConfigured) return;
  started = true;
  applyRef = async (session: { user: { id: string; email?: string } } | null) => {
    if (!session) {
      await stopSync();
      stopSubscription();
      set({ status: "signedOut" });
      return;
    }
    try {
      await startSync(session.user.id);
    } catch {
      // Sem internet e sem cópia local: não mostramos uma conta "vazia" (evitaria sobrescrever a nuvem).
      set({ status: "error" });
      return;
    }
    set({ status: "ready", email: session.user.email ?? "" });
    startSubscription(session.user.id);
    void flushPendingUploads();
  };
  getSession().then((s) => applyRef!(s)).catch(() => set({ status: "signedOut" }));
  let last: string | null = null;
  onAuthChange((s) => {
    const id = s?.user.id ?? null;
    if (id !== last) {
      last = id;
      void applyRef!(s);
    }
  });
}

/** Tenta carregar de novo os dados da conta (botão da tela de erro). */
export function retryLoad(): void {
  set({ status: "loading" });
  getSession().then((s) => applyRef?.(s)).catch(() => set({ status: "error" }));
}

const translate = (msg: string): string => {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Toque em Entrar.";
  if (/password should be/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/email not confirmed/i.test(msg)) return "NOT_CONFIRMED";
  if (/rate limit|too many|over_email_send_rate_limit|after \d+ seconds/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/same.*password|different from the old/i.test(msg)) return "Escolha uma senha diferente da atual.";
  if (/session.*missing|not authenticated|jwt/i.test(msg)) return "O link venceu. Peça um novo em \"Esqueci minha senha\".";
  if (/valid email|invalid.*email/i.test(msg)) return "E-mail inválido.";
  if (/fetch|network/i.test(msg)) return "Sem internet. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
};

export async function login(email: string, password: string): Promise<string | null> {
  const { error } = await signIn(email.trim(), password);
  if (!error) return null;
  const msg = translate(error.message);
  return msg === "NOT_CONFIRMED" ? "NOT_CONFIRMED" : msg;
}

/** Retorna mensagem de erro, ou "CONFIRM" quando precisa confirmar o e-mail. */
export async function register(email: string, password: string): Promise<string | null> {
  const { data, error } = await signUp(email.trim(), password, location.origin);
  if (error) return translate(error.message);
  return data.session ? null : "CONFIRM";
}

export const logout = () => signOut();

export const RESET_PATH = "/redefinir-senha";

/** Pede o e-mail de "esqueci a senha". Retorna uma mensagem de erro, ou null (sem revelar se o e-mail tem conta). */
export async function forgotPassword(email: string): Promise<string | null> {
  const { error } = await requestPasswordReset(email.trim(), location.origin + RESET_PATH);
  if (!error) return null;
  const msg = translate(error.message);
  return msg === "NOT_CONFIRMED" ? null : msg;
}

/** Reenvia o e-mail de confirmação da conta. */
export async function resendConfirmationEmail(email: string): Promise<string | null> {
  const { error } = await resendConfirmation(email.trim(), location.origin);
  return error ? translate(error.message) : null;
}

/** Grava a nova senha (a pessoa chegou pelo link do e-mail, então já tem uma sessão de recuperação). */
export async function setNewPassword(password: string): Promise<string | null> {
  const { error } = await updatePassword(password);
  return error ? translate(error.message) : null;
}

export { recoveryLink };
export const cloudEnabled = cloudConfigured;
