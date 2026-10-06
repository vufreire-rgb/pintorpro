"use client";
import { useState } from "react";
import { Check, QrCode } from "lucide-react";
import { Button, Card, CardTitle, Chip, Field, TextInput } from "./ui";
import { normalizePixKey, PIX_TYPE_LABEL, type PixKeyType } from "@/modules/pix";
import { saveCompany } from "@/modules/settings";
import type { Company } from "@/modules/types";

/** Oferece cadastrar a chave Pix logo depois do primeiro orçamento, quando o pintor já viu o valor do app. */
export function PixSetupCard({ company }: { company: Company }) {
  const [type, setType] = useState<PixKeyType>("phone");
  const [key, setKey] = useState("");
  const valid = !!key && !!normalizePixKey(type, key);
  return (
    <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
      <CardTitle icon={QrCode}>Receba a entrada por Pix</CardTitle>
      <p className="text-base">Cadastre sua chave Pix e o orçamento já sai com o QR para o cliente pagar a entrada.</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PIX_TYPE_LABEL) as PixKeyType[]).map((t) => <Chip key={t} active={type === t} onClick={() => { setType(t); setKey(""); }}>{PIX_TYPE_LABEL[t]}</Chip>)}
      </div>
      <Field label={`Sua chave Pix (${PIX_TYPE_LABEL[type].toLowerCase()})`}>
        <TextInput value={key} inputMode={type === "email" ? "email" : "text"} onChange={(e) => setKey(e.target.value)} />
      </Field>
      {key && !valid ? <p className="text-base text-err">Essa chave não parece certa para o tipo escolhido.</p> : null}
      <Button icon={Check} disabled={!valid} onClick={() => saveCompany({ ...company, pix: { type, key, name: company.pix?.name, city: company.pix?.city }, pixAsked: true })}>Salvar chave Pix</Button>
      <Button variant="ghost" onClick={() => saveCompany({ ...company, pixAsked: true })}>Agora não</Button>
      <p className="text-base text-support">Você pode cadastrar depois em Ajustes.</p>
    </Card>
  );
}
