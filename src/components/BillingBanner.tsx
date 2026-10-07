"use client";
import { accessMessage } from "@/modules/billing";
import { CHECKOUT_URL, useSubscription } from "@/modules/subscription";

/** Aviso antes de vencer e depois de vencer (por até 3 dias). Só aparece com a cobrança ligada. */
export function BillingBanner() {
  const { access } = useSubscription();
  if (!access || (access.level !== "ending" && access.level !== "grace")) return null;
  const m = accessMessage(access);
  if (!m) return null;
  return (
    <div role="status" className="flex flex-col gap-1 border-b border-amber-300 bg-amber-100 p-3 text-base text-[#5c3200]" data-testid="billing-banner">
      <b>{m.title}</b>
      <span>{m.text}</span>
      {CHECKOUT_URL ? <a className="font-bold underline" href={CHECKOUT_URL}>Assinar agora</a> : null}
    </div>
  );
}
