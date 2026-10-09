"use client";
import { Mic, Ruler } from "lucide-react";
import { Screen } from "./ui";
import { saveCompany } from "@/modules/settings";
import type { Company } from "@/modules/types";

/** Primeira vez em "Novo orçamento": o pintor escolhe como prefere orçar, já vendo o que cada jeito faz. */
export function QuoteModeFirstAsk({ company }: { company: Company }) {
  const pick = (m: "calc" | "simple") => saveCompany({ ...company, quoteMode: m, quoteModeAsked: true });
  const opt = "flex w-full items-center gap-3 rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,59,122,.05)] active:bg-brand-soft";
  return (
    <Screen title="Novo orçamento" back="/orcamentos">
      <h2 className="font-display text-xl font-medium leading-[26px]">Como você prefere fazer este orçamento?</h2>
      <button type="button" className={opt} onClick={() => pick("calc")}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Ruler size={24} strokeWidth={2.2} aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block font-display text-xl font-medium leading-[26px]">Calcular pelas medidas</span><span className="block text-base leading-[22px] text-support">Você mede os ambientes e o app calcula preço, prazo e lucro.</span></span>
      </button>
      <button type="button" className={opt} onClick={() => pick("simple")}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Mic size={24} strokeWidth={2.2} aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block font-display text-xl font-medium leading-[26px]">Só falar o valor</span><span className="block text-base leading-[22px] text-support">Você diz ou digita o preço fechado. Sem medidas nem contas.</span></span>
      </button>
      <p className="text-base leading-[22px] text-support">Você pode trocar isso depois em Ajustes. Nada é apagado.</p>
    </Screen>
  );
}
