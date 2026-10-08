"use client";
import { useState } from "react";
import { Check, QrCode } from "lucide-react";
import { Button, Card, CardTitle } from "./ui";
import { PixKeyInput, type PixKeyValue } from "./PixKeyInput";
import { saveCompany } from "@/modules/settings";
import type { Company } from "@/modules/types";

/** Oferece cadastrar a chave Pix logo depois do primeiro orçamento, quando o pintor já viu o valor do app. */
export function PixSetupCard({ company }: { company: Company }) {
  const [pix, setPix] = useState<PixKeyValue | null>(null);
  return (
    <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
      <CardTitle icon={QrCode}>Receba a entrada por Pix</CardTitle>
      <p className="text-base">Cadastre sua chave Pix e o orçamento já sai com o QR para o cliente pagar a entrada.</p>
      <PixKeyInput onChange={setPix} />
      <Button icon={Check} disabled={!pix} onClick={() => pix && saveCompany({ ...company, pix: { type: pix.type, key: pix.key, name: company.pix?.name, city: company.pix?.city }, pixAsked: true })}>Salvar chave Pix</Button>
      <Button variant="ghost" onClick={() => saveCompany({ ...company, pixAsked: true })}>Agora não</Button>
      <p className="text-base text-support">Você pode cadastrar depois em Ajustes.</p>
    </Card>
  );
}
