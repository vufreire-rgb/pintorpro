"use client";
import { Chip } from "./ui";
import { DictationField } from "./DictationField";
import { organizeMaterials } from "@/modules/dictation";

/** Lista de materiais da obra: escrita ou ditada, um item por linha (o que for ditado já sai em lista). Escolher se aparece para o cliente. */
export function MaterialsField({ text, onText, show, onShow }: { text: string; onText: (t: string) => void; show: boolean; onShow: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <DictationField
        label="Lista de materiais da obra (opcional)"
        hint="Um item por linha. Ao ditar, a lista já sai organizada. Fica guardada para você e para mandar à loja de tintas depois."
        value={text}
        onChange={onText}
        organize={organizeMaterials}
        placeholder={"Ex.:\n2 latas de tinta acrílica branco gelo 18 L\n1 massa corrida 25 kg\n3 rolos de lã"}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-base">Mostrar a lista no PDF e no link do cliente</span>
        <Chip active={show} onClick={() => onShow(!show)}>{show ? "Sim" : "Não"}</Chip>
      </div>
    </div>
  );
}
