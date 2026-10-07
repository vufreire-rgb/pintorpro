"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button, Section } from "./ui";
import { cloudEnabled } from "@/modules/auth";
import { disablePush, enablePush, PUSH_TEXT, testPush, usePushState } from "@/modules/push";

/** Ajustes: liga os avisos no celular (cliente abriu o orçamento, pedido novo). Só com conta. */
export function PushCard() {
  const { state, reload } = usePushState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!cloudEnabled) return null;
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(""); try { await fn(); } finally { setBusy(false); reload(); } };
  return (
    <Section title="Notificações" hint={state === "on" ? "Ligadas neste celular" : "Avisos no celular"}>
      <p className="text-base text-support">Receba um aviso no celular quando o cliente <b>abrir o seu orçamento</b> e quando chegar um <b>pedido novo</b> pela sua página.</p>
      {state === "loading" ? <p className="text-base text-support">Verificando…</p> : <p role="status" className="text-base">{PUSH_TEXT[state]}</p>}
      {state === "off" ? (
        <Button icon={Bell} disabled={busy} onClick={() => void run(async () => { const r = await enablePush(); if (r === "failed") setMsg("Não consegui ligar agora. Verifique a internet e tente de novo."); else if (r === "denied") setMsg(PUSH_TEXT.denied); })}>{busy ? "Ligando…" : "Ligar avisos neste celular"}</Button>
      ) : null}
      {state === "on" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { try { setMsg((await testPush()) > 0 ? "Teste enviado. Deve chegar em instantes." : "Não encontrei este celular no servidor. Desligue e ligue de novo."); } catch { setMsg("Não consegui enviar o teste agora."); } })}>Enviar teste</Button>
          <Button variant="danger" disabled={busy} onClick={() => void run(() => disablePush())}>Desligar</Button>
        </div>
      ) : null}
      {msg ? <p role="status" className="text-base text-support">{msg}</p> : null}
    </Section>
  );
}
