"use client";
import { useSyncExternalStore } from "react";

/** Instalação como app (PWA) e service worker. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pintorpro:install-dismissed";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let deferred: InstallEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // guardamos para mostrar o nosso botão
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}

export type InstallState = "hidden" | "can-prompt" | "ios" | "manual";

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function readState(ignoreDismissed: boolean): InstallState {
  if (isStandalone()) return "hidden";
  if (!ignoreDismissed) {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return "hidden";
    } catch {
      /* ignora */
    }
  }
  if (deferred) return "can-prompt";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "manual";
  return "hidden";
}

export const useInstallState = (ignoreDismissed = false): InstallState =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => readState(ignoreDismissed),
    () => "hidden" as InstallState,
  );

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  const ev = deferred;
  await ev.prompt();
  await ev.userChoice;
  deferred = null;
  notify();
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignora */
  }
  notify();
}
