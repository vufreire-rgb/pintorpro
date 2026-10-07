import { useCallback, useEffect, useState } from "react";
import { fetchPushKey, removePushSubscription, savePushSubscription, sendPushTest } from "@/repositories/cloudStore";
import { cloudEnabled } from "./auth";
import { isStandalone } from "./pwa";

/** Notificações no celular. "needs-install": no iPhone só funciona com o app instalado na tela inicial. */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const supported = (): boolean => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** A chave pública vem em base64url; o navegador quer bytes. */
export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

/** O service worker só existe na versão publicada; sem ele, espera pouco e desiste. */
const readyRegistration = (): Promise<ServiceWorkerRegistration | null> =>
  Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);

export async function pushState(): Promise<PushState> {
  if (!cloudEnabled || typeof window === "undefined") return "unsupported";
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await readyRegistration();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Pede permissão, cria a inscrição deste aparelho e guarda no servidor. Devolve o novo estado ou "failed". */
export async function enablePush(): Promise<PushState | "failed"> {
  const now = await pushState();
  if (now === "unsupported" || now === "needs-install" || now === "denied") return now;
  try {
    if ((await Notification.requestPermission()) !== "granted") return Notification.permission === "denied" ? "denied" : "off";
    const reg = await readyRegistration();
    if (!reg) return "unsupported";
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(await fetchPushKey()) as BufferSource }));
    await savePushSubscription(sub.toJSON());
    return "on";
  } catch {
    return "failed";
  }
}

export async function disablePush(): Promise<void> {
  const reg = await readyRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** Manda uma notificação de teste para os aparelhos do pintor. Devolve quantas foram enviadas. */
export const testPush = (): Promise<number> => sendPushTest();

export const PUSH_TEXT: Record<PushState, string> = {
  unsupported: "Este navegador não consegue mostrar notificações. No Android, use o Chrome.",
  "needs-install": "No iPhone, primeiro instale o Medde na tela inicial (botão Compartilhar → Adicionar à Tela de Início) e abra o app por lá.",
  denied: "As notificações estão bloqueadas para o Medde. Libere em Configurações do celular → Aplicativos (ou do site) → Notificações.",
  off: "Desligadas neste celular.",
  on: "Ligadas neste celular.",
};

/** Estado das notificações, atualizado ao abrir e depois de ligar ou desligar. */
export function usePushState(): { state: PushState | "loading"; reload: () => void } {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    pushState().then((s) => { if (alive) setState(s); }).catch(() => { if (alive) setState("unsupported"); });
    return () => { alive = false; };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
