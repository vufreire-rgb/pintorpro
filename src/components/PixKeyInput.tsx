"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Chip, Field, TextInput } from "./ui";
import { guessPixType, normalizePixKey, PIX_TYPE_LABEL, type PixKeyType } from "@/modules/pix";

export interface PixKeyValue { type: PixKeyType; key: string }

/**
 * Um campo só para a chave Pix: o app reconhece se é e-mail, CPF/CNPJ, celular ou chave aleatória.
 * Só pergunta quando são 11 números soltos (CPF ou celular). `onChange` recebe a chave válida, ou null enquanto não vale.
 */
export function PixKeyInput({ initial, onChange }: { initial?: PixKeyValue; onChange: (v: PixKeyValue | null) => void }) {
  const [text, setText] = useState(initial?.key ?? "");
  const [chosen, setChosen] = useState<PixKeyType | null>(initial?.type ?? null);
  const guess = guessPixType(text);
  const type: PixKeyType | null = guess === "ask" ? (chosen === "doc" || chosen === "phone" ? chosen : null) : guess;
  const valid = !!text && !!type && !!normalizePixKey(type, text);

  const update = (nextText: string, nextChosen: PixKeyType | null) => {
    const g = guessPixType(nextText);
    const t = g === "ask" ? (nextChosen === "doc" || nextChosen === "phone" ? nextChosen : null) : g;
    setText(nextText);
    setChosen(nextChosen);
    onChange(t && normalizePixKey(t, nextText) ? { type: t, key: nextText } : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="Sua chave Pix" hint="CPF, CNPJ, celular, e-mail ou chave aleatória. O app reconhece sozinho.">
        <TextInput value={text} onChange={(e) => update(e.target.value, chosen)} autoComplete="off" />
      </Field>
      {guess === "ask" ? (
        <div className="flex flex-col gap-2">
          <p className="text-base font-bold">Esses números são de…</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={chosen === "doc"} onClick={() => update(text, "doc")}>CPF</Chip>
            <Chip active={chosen === "phone"} onClick={() => update(text, "phone")}>Celular</Chip>
          </div>
        </div>
      ) : null}
      {valid && type ? <p className="inline-flex items-center gap-1.5 text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden />Chave válida ({PIX_TYPE_LABEL[type].toLowerCase()})</p> : null}
      {text && guess !== "ask" && !valid ? <p className="text-base text-err">Essa chave não parece certa. Confira o número ou o e-mail.</p> : null}
    </div>
  );
}
