"use client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, NumberInput, Screen, TextArea2, TextInput } from "./ui";
import { addClient } from "@/modules/clients";
import { saveQuote, updateQuote } from "@/modules/quotes";
import { quoteFromVoice, DEFAULT_DESCRIPTION } from "@/modules/voice";
import type { Db, Quote, Visit } from "@/modules/types";
import { formatBRL } from "@/shared/money";

const EMPTY_DRAFT = { clientName: "", phone: "", address: "", rooms: [], closedPriceReais: 0, paymentTerms: "", notes: "" };

/** Modo simples: orçamento só com cliente, o que será feito e o preço. Sem medidas, serviços nem cálculo. */
export function SimpleQuoteForm({ db, quote, visit }: { db: Db; quote?: Quote; visit?: Visit }) {
  const router = useRouter();
  const [pickedClient, setClientId] = useState<string | null>(null);
  const clientId = pickedClient ?? quote?.clientId ?? visit?.clientId ?? "";
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [address, setAddress] = useState(quote?.siteAddress ?? visit?.siteAddress ?? "");
  const [description, setDescription] = useState(quote?.input.extras[0]?.description ?? "");
  const [price, setPrice] = useState(quote ? quote.result.totals.totalCents / 100 : 0);
  const [payment, setPayment] = useState(quote?.paymentTerms ?? db.company?.paymentTerms ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");

  const chosen = db.clients.find((c) => c.id === clientId);
  const hasClient = !!chosen || !!newClient.name.trim();
  const canSave = hasClient && price > 0;
  const siteValue = address || chosen?.address || "";

  const save = () => {
    const built = quoteFromVoice(db, { ...EMPTY_DRAFT, closedPriceReais: price }, { simple: true, description: description || DEFAULT_DESCRIPTION });
    const input = { rooms: built.rooms, extras: built.extras, adjustment: built.adjustment };
    if (quote) {
      updateQuote(db, quote.id, { siteAddress: siteValue, input, paymentTerms: payment, notes });
      router.replace(`/orcamentos/${quote.id}`);
      return;
    }
    const cid = clientId || addClient({ name: newClient.name.trim(), phone: newClient.phone.trim(), address: siteValue }).id;
    const id = saveQuote(db, { clientId: cid, visitId: visit?.id, siteAddress: siteValue, input, paymentTerms: payment, notes });
    router.replace(`/orcamentos/${id}`);
  };

  return (
    <Screen title={quote ? `Editar orçamento nº ${quote.number}` : "Orçamento"} back={quote ? `/orcamentos/${quote.id}` : visit ? `/visitas/${visit.id}` : "/orcamentos"}>
      <div className="flex flex-col gap-4 pb-36">
        <Card className="flex flex-col gap-3">
          <b>Cliente</b>
          {chosen ? (
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-lg font-semibold">{chosen.name}</div>{chosen.phone ? <div className="text-support">{chosen.phone}</div> : null}</div>
              {!quote ? <button className="min-h-10 px-2 text-brand underline" onClick={() => setClientId("")}>Trocar</button> : null}
            </div>
          ) : (
            <>
              {db.clients.length > 0 ? <div className="flex flex-wrap gap-2">{db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => setClientId(c.id)}>{c.name}</Chip>)}</div> : null}
              <Field label={db.clients.length > 0 ? "Ou cliente novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
              <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            </>
          )}
          <Field label="Endereço da obra"><TextArea2 value={siteValue} onChange={(e) => setAddress(e.target.value)} /></Field>
        </Card>
        <Card className="flex flex-col gap-3">
          <Field label="O que será feito" hint="Aparece no orçamento do cliente. Ex.: Pintura da sala e dos quartos, 2 demãos, tinta inclusa.">
            <TextArea2 value={description} placeholder={DEFAULT_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Preço fechado (R$)"><NumberInput aria-label="Preço fechado" value={price} onChange={(n) => setPrice(Math.max(0, n))} /></Field>
          <Field label="Forma de pagamento"><TextInput value={payment} onChange={(e) => setPayment(e.target.value)} /></Field>
          <Field label="Observações (opcional)" hint="Aparecem no PDF, na página de combinados."><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <div className="text-base text-support">Preço para o cliente</div>
          <div className="font-display text-[28px] font-semibold leading-8 text-brand" data-testid="total">{price > 0 ? formatBRL(Math.round(price * 100)) : "—"}</div>
          {!canSave ? <div className="text-base text-support">{!hasClient ? "Falta o cliente" : "Falta o preço"}</div> : null}
        </div>
        <Button className="!w-auto shrink-0 !px-5" aria-label={quote ? undefined : "Salvar orçamento"} icon={Check} disabled={!canSave} onClick={save}>Salvar</Button>
      </div>
    </Screen>
  );
}
