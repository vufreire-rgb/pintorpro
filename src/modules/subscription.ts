"use client";
import { useSyncExternalStore } from "react";
import { pullSubscription } from "@/repositories/cloudStore";
import { getMeta, setMeta } from "@/repositories/localStore";
import { accessOf, type Access, type SubStatus, type Subscription } from "./billing";

/**
 * Assinatura da conta logada. DORMENTE por padrão: só vale com NEXT_PUBLIC_BILLING_ENFORCE=1 (ligado quando o pagamento existir).
 * Sem internet usa a última resposta guardada; sem nenhuma resposta, NÃO bloqueia (falha aberta).
 */
export const BILLING_ENFORCED = process.env.NEXT_PUBLIC_BILLING_ENFORCE === "1";
/** Para onde o botão "Assinar" leva (checkout do gateway). Vazio = ainda não há pagamento. */
export const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL ?? "";

interface State { sub: Subscription | null; access: Access | null; loaded: boolean }
let state: State = { sub: null, access: null, loaded: false };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  listeners.forEach((l) => l());
};

const STATUSES: SubStatus[] = ["trial", "active", "canceled"];
function parse(row: { status: string; trial_ends_at: string; current_period_end: string | null } | null): Subscription | null {
  if (!row || !STATUSES.includes(row.status as SubStatus)) return null;
  return { status: row.status as SubStatus, trialEndsAt: row.trial_ends_at, periodEnd: row.current_period_end };
}
const apply = (sub: Subscription | null) => set({ sub, access: sub ? accessOf(sub) : null, loaded: true });

let timer: ReturnType<typeof setInterval> | null = null;
let onVisible: (() => void) | null = null;

async function refresh(uid: string): Promise<void> {
  try {
    const sub = parse(await pullSubscription(uid));
    if (sub) setMeta("sub", JSON.stringify(sub));
    apply(sub);
  } catch {
    // sem internet: usa o que já sabíamos
    if (!state.loaded) {
      try {
        const cached = getMeta("sub");
        apply(cached ? (JSON.parse(cached) as Subscription) : null);
      } catch {
        apply(null);
      }
    } else if (state.sub) {
      apply(state.sub); // recalcula com o relógio de agora
    }
  }
}

/** Chamado depois do login. Atualiza ao abrir, ao voltar para o app e a cada 30 minutos. */
export function startSubscription(uid: string): void {
  stopSubscription();
  if (!BILLING_ENFORCED) return;
  void refresh(uid);
  timer = setInterval(() => void refresh(uid), 30 * 60 * 1000);
  onVisible = () => { if (document.visibilityState === "visible") void refresh(uid); };
  document.addEventListener("visibilitychange", onVisible);
}

export function stopSubscription(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (onVisible) document.removeEventListener("visibilitychange", onVisible);
  onVisible = null;
  state = { sub: null, access: null, loaded: false };
  listeners.forEach((l) => l());
}

export const useSubscription = (): State =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => state,
  );
