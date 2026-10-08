"use client";
import { dismissInstall, promptInstall, useInstallState } from "@/modules/pwa";
import { APP_NAME } from "@/shared/brand";
import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui";

/** Ensina (ou faz) a instalação do app no celular. `always`: ignora o "agora não" (usado em Ajustes). */
export function InstallBanner({ always = false }: { always?: boolean }) {
  const state = useInstallState(always);
  const [open, setOpen] = useState(false);
  if (state === "hidden") return null;
  if (!always) {
    // Faixa pequena: uma linha. Os passos só aparecem se a pessoa tocar em "Como".
    return (
      <section className="rounded-2xl border border-brand/25 bg-brand-soft p-3">
        <div className="flex items-center gap-2">
          <Smartphone size={22} strokeWidth={2.2} aria-hidden className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-base font-bold leading-tight">Instale o {APP_NAME} no celular</p>
          {state === "can-prompt"
            ? <Button className="!w-auto shrink-0 !min-h-11 !px-4 !text-base" onClick={() => promptInstall()}>Instalar</Button>
            : <Button variant="ghost" className="!w-auto shrink-0 !min-h-11 !px-4 !text-base" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Como</Button>}
          <button type="button" aria-label="Agora não" onClick={dismissInstall} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-support"><X size={22} aria-hidden /></button>
        </div>
        {open && state !== "can-prompt" ? (
          state === "ios" ? (
            <ol className="mt-2 list-decimal pl-6">
              <li>Toque em <b>Compartilhar</b> (o quadrado com a seta ↑), na barra do Safari.</li>
              <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
            </ol>
          ) : (
            <ol className="mt-2 list-decimal pl-6">
              <li>Toque nos <b>três pontinhos ⋮</b> do Chrome.</li>
              <li>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li>
            </ol>
          )
        ) : null}
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Smartphone size={24} strokeWidth={2.2} aria-hidden className="shrink-0 text-brand" />Instale o {APP_NAME} no celular</h2>
      {state === "can-prompt" ? (
        <>
          <p>Abre em tela cheia, como um aplicativo, direto da tela inicial.</p>
          <Button onClick={() => promptInstall()}>Instalar app</Button>
        </>
      ) : state === "ios" ? (
        <ol className="list-decimal pl-5">
          <li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta ↑), na barra do Safari.</li>
          <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
          <li>Toque em <b>Adicionar</b>.</li>
        </ol>
      ) : (
        <ol className="list-decimal pl-5">
          <li>Toque nos <b>três pontinhos ⋮</b> do Chrome.</li>
          <li>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li>
        </ol>
      )}
    </section>
  );
}
