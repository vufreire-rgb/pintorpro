"use client";
import { DictateButton } from "./DictateButton";
import { Field, TextArea2 } from "./ui";
import { appendDictation } from "@/modules/dictation";

/** Campo de texto com ditado: o que a pessoa falar é escrito no fim do texto que já existe. */
export function DictationField({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (text: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint}><TextArea2 aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></Field>
      <div className="self-end"><DictateButton onText={(t) => onChange(appendDictation(value, t))} /></div>
    </div>
  );
}
