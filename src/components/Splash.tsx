"use client";
import { useEffect, useState } from "react";

const KEY = "pintorpro:splash";

/** Abertura do app: o símbolo sobre o azul, por 1 segundo, uma vez por sessão. Não aparece em teste automático. */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">(() => {
    try {
      if (typeof navigator === "undefined" || navigator.webdriver || sessionStorage.getItem(KEY)) return "gone";
      sessionStorage.setItem(KEY, "1");
      return "show";
    } catch {
      return "gone";
    }
  });
  useEffect(() => {
    if (phase !== "show") return;
    const a = setTimeout(() => setPhase("fade"), 900);
    const b = setTimeout(() => setPhase("gone"), 1200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [phase]);
  if (phase === "gone") return null;
  return (
    <div aria-hidden className={`fixed inset-0 z-[60] grid place-items-center bg-[#0F3B7A] transition-opacity duration-300 motion-reduce:transition-none ${phase === "fade" ? "opacity-0" : "opacity-100"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/simbolo-sobre-escuro.svg" alt="" className="h-28 w-28" />
    </div>
  );
}
