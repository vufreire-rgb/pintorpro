"use client";
import { Chip } from "./ui";

/** Escolha de como o pintor orça. Vale no cadastro e em Ajustes; pode trocar quando quiser. */
export function QuoteModeChoice({ value, onChange }: { value: "calc" | "simple"; onChange: (m: "calc" | "simple") => void }) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Como você faz orçamento?">
      <b className="text-lg">Como você faz orçamento?</b>
      <div className="flex flex-col gap-2">
        <Chip active={value === "calc"} onClick={() => onChange("calc")}>Com cálculo: medidas, preços e lucro</Chip>
        <Chip active={value === "simple"} onClick={() => onChange("simple")}>Só voz e preço fechado</Chip>
      </div>
      <p className="text-base text-support">
        {value === "simple"
          ? "Você fala ou digita o preço e pronto. O app esconde preços, medidas e lucro. Você não vê o aviso de prejuízo, a lista de materiais nem o prazo calculado."
          : "O app calcula pelas medidas e pelos seus preços, e mostra custo, lucro, materiais e prazo. A voz também funciona."}
      </p>
      <p className="text-base text-support">Você pode trocar isso depois em Ajustes. Nada é apagado.</p>
    </div>
  );
}
