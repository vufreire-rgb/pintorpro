"use client";
import Link from "next/link";
import { Chip, Field, NumberInput, TextInput } from "./ui";
import { normalizePixKey } from "@/modules/pix";
import { saveCompany } from "@/modules/settings";
import type { Company } from "@/modules/types";

export interface PaymentChoice { pix: boolean; card: boolean; link: string; pct: number; installments: number }

/** Valor inicial: o que o orçamento já tinha, ou o que o pintor tem cadastrado (Pix e link padrão). */
export function initialPayment(company: Company | null | undefined, q?: { payPix?: boolean; payCard?: boolean; paymentLink?: string; depositPct?: number; payInstallments?: number }): PaymentChoice {
  const hasPix = !!company?.pix && !!normalizePixKey(company.pix.type, company.pix.key);
  const link = q?.paymentLink ?? company?.paymentLink ?? "";
  return { pix: q?.payPix ?? hasPix, card: q?.payCard ?? !!link.trim(), link, pct: q?.depositPct ?? company?.depositPct ?? 50, installments: q?.payInstallments ?? 1 };
}

/** Link a guardar no orçamento: só se for válido (https). */
export const payLinkValue = (c: PaymentChoice): string | undefined => (c.card && validPaymentLink(c.link) ? c.link.trim() : undefined);

export const validPaymentLink = (v: string): boolean => /^https:\/\/\S+$/i.test(v.trim());

/**
 * "Como o cliente paga a entrada": o pintor escolhe Pix, cartão (pelo link de pagamento dele) ou os dois.
 * O dinheiro vai direto para a conta dele: o Medde não recebe nem guarda dinheiro.
 */
export function PaymentOptionsField({ company, value, onChange }: { company: Company | null | undefined; value: PaymentChoice; onChange: (v: PaymentChoice) => void }) {
  const hasPix = !!company?.pix && !!normalizePixKey(company.pix.type, company.pix.key);
  const linkOk = validPaymentLink(value.link);
  const set = (patch: Partial<PaymentChoice>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <b className="text-lg">Como o cliente paga a entrada</b>
      <p className="text-base text-support">O cliente vê isto depois de tocar em <b>Fechar agora</b>. O dinheiro vai <b>direto para você</b>: o Medde não recebe nem guarda dinheiro.</p>
      <div className="flex items-center justify-between gap-3">
        <span>Pix (QR e copia e cola)</span>
        <Chip active={value.pix && hasPix} onClick={() => hasPix && set({ pix: !value.pix })}>{value.pix && hasPix ? "Sim" : "Não"}</Chip>
      </div>
      {!hasPix ? <p className="text-base text-support">Para oferecer Pix, cadastre sua chave em <Link href="/configuracoes" className="font-semibold text-live underline">Ajustes → Receber por Pix</Link>.</p> : null}
      <div className="flex items-center justify-between gap-3">
        <span>Cartão (pelo seu link de pagamento)</span>
        <Chip active={value.card} onClick={() => set({ card: !value.card })}>{value.card ? "Sim" : "Não"}</Chip>
      </div>
      {value.card ? (
        <>
          <Field label="Seu link de pagamento" hint="Crie no app do seu banco ou do Mercado Pago, InfinitePay, PagBank… (procure “link de pagamento” ou “cobrar por link”) e cole aqui. O cartão cai na sua conta, e você escolhe parcelamento e taxa lá.">
            <TextInput type="url" inputMode="url" placeholder="https://" value={value.link} onChange={(e) => set({ link: e.target.value })} />
          </Field>
          <Field label="Em quantas vezes o cliente pode pagar no cartão?" hint="Só para avisar o cliente. As parcelas e a taxa valem o que você configurou no seu link de pagamento.">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => <Chip key={n} active={value.installments === n} onClick={() => set({ installments: n })}>{n === 1 ? "À vista" : `${n}x`}</Chip>)}
            </div>
          </Field>
          {value.link.trim() && !linkOk ? <p role="alert" className="text-base text-err">O link precisa começar com https://</p> : null}
          {linkOk && company && value.link.trim() !== (company.paymentLink ?? "") ? (
            <button type="button" className="min-h-12 text-left font-display font-semibold text-brand underline" onClick={() => saveCompany({ ...company, paymentLink: value.link.trim() })}>Usar sempre este link nos próximos orçamentos</button>
          ) : null}
        </>
      ) : null}
      {(value.pix && hasPix) || (value.card && linkOk) ? <Field label="Entrada (% do valor total)"><NumberInput value={value.pct} onChange={(n) => set({ pct: Math.min(100, Math.max(1, n || 50)) })} /></Field> : null}
    </div>
  );
}
