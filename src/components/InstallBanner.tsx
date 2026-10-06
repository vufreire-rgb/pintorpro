"use client";
import { dismissInstall, promptInstall, useInstallState } from "@/modules/pwa";
import { APP_NAME } from "@/shared/brand";
import { Smartphone } from "lucide-react";
import { Button } from "./ui";

/** Ensina (ou faz) a instalação do app no celular. `always`: ignora o "agora não" (usado em Ajustes). */
export function InstallBanner({ always = false }: { always?: boolean }) {
  const state = useInstallState(always);
  if (state === "hidden") return null;
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
      {!always ? <Button variant="ghost" className="min-h-12 text-base" onClick={dismissInstall}>Agora não</Button> : null}
    </section>
  );
}
