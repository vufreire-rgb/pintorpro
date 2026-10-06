"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Card, CardTitle, NumberInput } from "./ui";
import { updateService } from "@/modules/settings";
import type { ServiceConfig } from "@/modules/types";
import { formatBRL, toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";

/** Um serviço do orçamento ainda com preço de exemplo: o pintor confirma ou troca, ali mesmo. */
function Row({ s }: { s: ServiceConfig }) {
  const [price, setPrice] = useState(s.salePriceCents / 100);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
      <b>{s.name}</b>
      <p className="text-base text-support">Quanto você cobra por {UNIT_LABEL[s.unit] ?? s.unit}? Sugestão: {formatBRL(s.salePriceCents)}</p>
      <NumberInput aria-label={`Preço de ${s.name}`} value={price} onChange={setPrice} />
      <Button variant="ghost" icon={Check} disabled={price <= 0} onClick={() => updateService(s.id, { salePriceCents: toCents(price) })}>
        {toCents(price) === s.salePriceCents ? "Está bom assim" : "Usar este preço"}
      </Button>
    </div>
  );
}

/** "Confirme seus preços": só aparece para serviços usados no orçamento que ainda têm valor de exemplo. */
export function PriceCheck({ services }: { services: ServiceConfig[] }) {
  if (services.length === 0) return null;
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Confirme seus preços</CardTitle>
      <p className="text-base text-support">Estes valores são de exemplo. Se estiverem bons, confirme todos de uma vez ou ajuste um por um.</p>
      {services.length > 1 ? <Button icon={Check} onClick={() => services.forEach((s) => updateService(s.id, { salePriceCents: s.salePriceCents }))}>Confirmar todos como estão</Button> : null}
      {services.map((s) => <Row key={s.id} s={s} />)}
    </Card>
  );
}
