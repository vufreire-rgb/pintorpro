"use client";
import { useSyncExternalStore } from "react";
import { cloudConfigured, getSession, onAuthChange, signIn, signOut, signUp } from "@/repositories/cloudStore";
import { flushPendingUploads } from "./photos";
import { getSyncStatus, startSync, stopSync, subscribeSync } from "./sync";

export type AuthState =
  | { status: "loading" }
  | { status: "local" } // sem nuvem configurada: funciona como antes
  | { status: "signedOut" }
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
if (typeof window !== "undefined") window.addEventListener("online", () => void flushPendingUploads());
/** Idempotente: chamar uma vez na raiz do app. */
export function initAuth(): void {
  if (started || !cloudConfigured) return;
  started = true;
  const apply = async (session: { user: { id: string; email?: string } } | null) => {
    if (!session) {
      await stopSync();
      set({ status: "signedOut" });
      return;
    }
    try {
      await startSync(session.user.id);
    } catch {
      /* sem internet: segue com o cache local deste aparelho */
    }
    set({ status: "ready", email: session.user.email ?? "" });
    void flushPendingUploads();
  };
  getSession().then(apply).catch(() => set({ status: "signedOut" }));
  let last: string | null = null;
  onAuthChange((s) => {
    const id = s?.user.id ?? null;
    if (id !== last) {
      last = id;
      void apply(s);
    }
  });
}

const translate = (msg: string): string => {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Toque em Entrar.";
  if (/password should be/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail (veja sua caixa de entrada) e tente de novo.";
  if (/valid email|invalid.*email/i.test(msg)) return "E-mail inválido.";
  if (/fetch|network/i.test(msg)) return "Sem internet. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
};

export async function login(email: string, password: string): Promise<string | null> {
  const { error } = await signIn(email.trim(), password);
  return error ? translate(error.message) : null;
}

/** Retorna mensagem de erro, ou "CONFIRM" quando precisa confirmar o e-mail. */
export async function register(email: string, password: string): Promise<string | null> {
  const { data, error } = await signUp(email.trim(), password);
  if (error) return translate(error.message);
  return data.session ? null : "CONFIRM";
}

export const logout = () => signOut();
export const cloudEnabled = cloudConfigured;
