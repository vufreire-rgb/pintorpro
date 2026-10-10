"use client";
import { DictationField } from "./DictationField";
import { AddressInput } from "./AddressInput";
import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, NumberInput, Screen, TextInput } from "./ui";
import { addClient } from "@/modules/clients";
import { uid } from "@/modules/db";
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

  // Separar por ambientes: cada ambiente com o seu valor (o total é a soma). O cliente escolhe quais fechar pelo link.
  const savedAreas = quote && quote.input.rooms.length === 0 && quote.input.extras.length >= 2 ? quote.input.extras.map((e) => ({ id: uid(), name: e.description, price: e.priceCents / 100 })) : [];
  const [byArea, setByArea] = useState(savedAreas.length > 0);
  const [areas, setAreas] = useState<{ id: string; name: string; price: number }[]>(savedAreas.length ? savedAreas : [{ id: uid(), name: "", price: 0 }, { id: uid(), name: "", price: 0 }]);
  const setArea = (id: string, patch: Partial<{ name: string; price: number }>) => setAreas((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const areaRows = areas.filter((a) => a.price > 0);
  const total = byArea ? areaRows.reduce((sum, a) => sum + Math.round(a.price * 100), 0) / 100 : price;

  const chosen = db.clients.find((c) => c.id === clientId);
  const hasClient = !!chosen || !!newClient.name.trim();
  const canSave = hasClient && total > 0;
  const siteValue = address || chosen?.address || "";

  const save = () => {
    const built = quoteFromVoice(db, { ...EMPTY_DRAFT, closedPriceReais: price }, { simple: true, description: description || DEFAULT_DESCRIPTION });
    const input = byArea
      ? { rooms: [], extras: areaRows.map((a, i) => ({ description: a.name.trim() || `Ambiente ${i + 1}`, priceCents: Math.round(a.price * 100), costCents: 0 })), adjustment: undefined }
      : { rooms: built.rooms, extras: built.extras, adjustment: built.adjustment };
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
          <AddressInput label="Endereço da obra" value={siteValue} onChange={setAddress} />
        </Card>
        <Card className="flex flex-col gap-3">
          {byArea ? (
            <div className="flex flex-col gap-3">
              <b>Ambientes e valores</b>
              <p className="text-base text-support">O cliente vê o valor de cada ambiente no link e escolhe quais fechar.</p>
              {areas.map((a, i) => (
                <div key={a.id} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1"><Field label={`Ambiente ${i + 1}`}><TextInput value={a.name} placeholder="Ex.: Sala" onChange={(e) => setArea(a.id, { name: e.target.value })} /></Field></div>
                  <div className="w-32 shrink-0"><Field label="Valor (R$)"><NumberInput aria-label={`Valor do ambiente ${i + 1}`} value={a.price} onChange={(n) => setArea(a.id, { price: Math.max(0, n) })} /></Field></div>
                  {areas.length > 2 ? <button type="button" aria-label={`Remover ambiente ${i + 1}`} className="grid h-14 w-12 shrink-0 place-items-center text-support" onClick={() => setAreas((x) => x.filter((y) => y.id !== a.id))}><X size={22} aria-hidden /></button> : null}
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setAreas((x) => [...x, { id: uid(), name: "", price: 0 }])}>Adicionar ambiente</Button>
              <button type="button" className="min-h-12 text-left font-display font-semibold text-brand underline" onClick={() => setByArea(false)}>Voltar para um preço só</button>
            </div>
          ) : (
            <>
              <DictationField label="O que será feito" hint="Aparece no orçamento do cliente. Ex.: Pintura da sala e dos quartos, 2 demãos, tinta inclusa." value={description} placeholder={DEFAULT_DESCRIPTION} onChange={setDescription} />
              <Field label="Preço fechado (R$)"><NumberInput aria-label="Preço fechado" value={price} onChange={(n) => setPrice(Math.max(0, n))} /></Field>
              <button type="button" className="min-h-12 text-left font-display font-semibold text-brand underline" onClick={() => setByArea(true)}>Separar por ambientes (cada um com o seu valor)</button>
            </>
          )}
          <Field label="Forma de pagamento"><TextInput value={payment} onChange={(e) => setPayment(e.target.value)} /></Field>
          <DictationField label="Observações (opcional)" hint="Aparecem no PDF, na página de combinados." value={notes} onChange={setNotes} />
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <div className="text-base text-support">Preço para o cliente</div>
          <div className="font-display text-[28px] font-semibold leading-8 text-brand" data-testid="total">{total > 0 ? formatBRL(Math.round(total * 100)) : "—"}</div>
          {!canSave ? <div className="text-base text-support">{!hasClient ? "Falta o cliente" : byArea ? "Falta o valor de algum ambiente" : "Falta o preço"}</div> : null}
        </div>
        <Button className="!w-auto shrink-0 !px-5" aria-label={quote ? undefined : "Salvar orçamento"} icon={Check} disabled={!canSave} onClick={save}>Salvar</Button>
      </div>
    </Screen>
  );
}
