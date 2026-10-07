"use client";
import { Download, LogOut } from "lucide-react";
import { Button, LinkButton } from "./ui";
import { DeleteAccountCard } from "./DeleteAccountCard";
import { downloadMyData, signOutAndWipe } from "@/modules/account";
import { accessMessage, PRICE_LABEL } from "@/modules/billing";
import { CHECKOUT_URL, useSubscription } from "@/modules/subscription";
import { APP_NAME } from "@/shared/brand";

/** Tela de acesso bloqueado: pagar, baixar os dados, excluir a conta ou sair. Nada do app abre por trás dela. */
export function BlockedScreen() {
  const { access } = useSubscription();
  const m = access ? accessMessage(access) : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6" data-testid="blocked-screen">
      <p className="text-base text-support">{APP_NAME}</p>
      <h1 className="font-display text-[28px] font-bold leading-9">{m?.title ?? "Acesso bloqueado"}</h1>
      <p className="text-lg">{m?.text} Seus dados continuam guardados na sua conta.</p>
      {CHECKOUT_URL ? (
        <LinkButton href={CHECKOUT_URL}>Assinar por {PRICE_LABEL}</LinkButton>
      ) : (
        <p className="rounded-xl bg-brand-soft p-3 text-base">O pagamento ainda está sendo preparado. Assim que estiver disponível, ele aparece aqui.</p>
      )}
      <Button variant="ghost" icon={Download} onClick={() => downloadMyData()}>Baixar meus dados</Button>
      <Button variant="ghost" icon={LogOut} onClick={() => void signOutAndWipe()}>Sair</Button>
      <DeleteAccountCard />
    </div>
  );
}
