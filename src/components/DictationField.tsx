"use client";
import { useState } from "react";
import { DictateButton } from "./DictateButton";
import { Field, TextArea2 } from "./ui";
import { appendDictation, dictationFailureText } from "@/modules/dictation";

/**
 * Campo de texto com ditado: o microfone fica DENTRO do campo, no canto de baixo.
 * O que a pessoa falar é escrito no fim do texto que já existe.
 * `organize` (opcional): depois de ditar, transforma o texto todo (ex.: em lista de materiais). Se falhar, fica o texto ditado.
 */
export function DictationField({ label, hint, value, onChange, placeholder, organize }: { label: string; hint?: string; value: string; onChange: (text: string) => void; placeholder?: string; organize?: (text: string) => Promise<string> }) {
  const [organizing, setOrganizing] = useState(false);
  const [error, setError] = useState("");
  const dictated = async (said: string) => {
    const full = appendDictation(value, said);
    onChange(full);
    if (!organize) return;
    setOrganizing(true);
    setError("");
    try {
      const out = await organize(full);
      if (out) onChange(out);
    } catch (e) {
      setError(dictationFailureText(e instanceof Error ? e.message : ""));
    } finally {
      setOrganizing(false);
    }
  };
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <TextArea2 aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ paddingBottom: 68, paddingRight: 72 }} />
        <div className="absolute bottom-3 right-3"><DictateButton round onText={(t) => void dictated(t)} /></div>
      </div>
      {organizing ? <p role="status" className="text-base text-support">Organizando em lista…</p> : null}
      {error ? <p role="alert" className="text-base text-err">{error}</p> : null}
    </Field>
  );
}
