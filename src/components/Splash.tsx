"use client";
import { useEffect, useState } from "react";

const KEY = "pintorpro:splash";

type Phase = "idle" | "show" | "fade";

/** Abertura do app: o símbolo sobre o azul, por 1 segundo, uma vez por sessão. Não aparece em teste automático. */
const shouldShow = (): boolean => {
  try {
    return !(typeof navigator === "undefined" || navigator.webdriver || sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
};

export function Splash() {
  // Servidor e primeira pintura do celular começam iguais (sem nada); a abertura só entra depois que a tela monta.
  const [phase, setPhase] = useState<Phase>("idle");
  useEffect(() => {
    if (!shouldShow()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("show");
    // Os dois relógios nascem juntos e só morrem com a tela. (Antes, o primeiro relógio mudava o estado, o que
    // cancelava o segundo e deixava uma camada transparente cobrindo a tela para sempre.)
    const a = setTimeout(() => setPhase("fade"), 900);
    const b = setTimeout(() => {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* ignora */ }
      setPhase("idle");
    }, 1200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "idle") return null;
  return (
    // pointer-events-none: mesmo que algo dê errado, essa camada NUNCA pode bloquear um toque.
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-[#0F3B7A] transition-opacity duration-300 motion-reduce:transition-none ${phase === "fade" ? "opacity-0" : "opacity-100"}`} data-testid="splash">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/simbolo-sobre-escuro.svg" alt="" className="h-28 w-28" />
    </div>
  );
}
