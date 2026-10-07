"use client";
import { CreditCard } from "lucide-react";
import { Card, CardTitle, LinkButton } from "./ui";
import { accessMessage, PRICE_LABEL, statusLine } from "@/modules/billing";
import { BILLING_ENFORCED, CHECKOUT_URL, useSubscription } from "@/modules/subscription";

/** Em Ajustes: situação da assinatura. Não aparece enquanto a cobrança estiver desligada. */
export function SubscriptionCard() {
  const { sub, access } = useSubscription();
  if (!BILLING_ENFORCED || !sub) return null;
  const m = access ? accessMessage(access) : null;
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle icon={CreditCard}>Assinatura</CardTitle>
      <p className="text-lg font-semibold">{statusLine(sub)}</p>
      <p className="text-base text-support">Valor: {PRICE_LABEL}.</p>
      {m ? <p className="text-base">{m.title}. {m.text}</p> : null}
      {CHECKOUT_URL ? <LinkButton href={CHECKOUT_URL} variant="ghost">{sub.status === "trial" ? "Assinar agora" : "Gerenciar pagamento"}</LinkButton> : null}
    </Card>
  );
}
