"use client";
import { useState } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { Button, Chip } from "./ui";
import { DictationField } from "./DictationField";
import { cloudEnabled } from "@/modules/auth";
import { dictationFailureText, organizeMaterials } from "@/modules/dictation";

/** Lista de materiais da obra: escrita ou ditada, um item por linha. Escolher se aparece para o cliente. */
export function MaterialsField({ text, onText, show, onShow }: { text: string; onText: (t: string) => void; show: boolean; onShow: (v: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const organize = async () => {
    setBusy(true);
    setError("");
    try {
      const list = await organizeMaterials(text);
      if (list) onText(list);
      else setError("Não encontrei materiais nesse texto. Escreva ou dite os itens e tente de novo.");
    } catch (e) {
      setError(dictationFailureText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <DictationField
        label="Lista de materiais da obra (opcional)"
        hint="Um item por linha. Fica guardada para você e para mandar à loja de tintas depois."
        value={text}
        onChange={onText}
        placeholder={"Ex.:\n2 latas de tinta acrílica branco gelo 18 L\n1 massa corrida 25 kg\n3 rolos de lã"}
      />
      {cloudEnabled && text.trim() ? (
        <Button type="button" variant="ghost" size="sm" icon={busy ? Loader2 : ListChecks} disabled={busy} onClick={organize}>{busy ? "Organizando…" : "Organizar em lista"}</Button>
      ) : null}
      {error ? <p role="alert" className="text-base text-err">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-base">Mostrar a lista no PDF e no link do cliente</span>
        <Chip active={show} onClick={() => onShow(!show)}>{show ? "Sim" : "Não"}</Chip>
      </div>
    </div>
  );
}
