"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PhotoGrid } from "@/components/PhotoGrid";
import { AudioList } from "@/components/AudioList";
import { Button, Card, Chip, Field, Loading, NumberInput, Screen, Stepper, TextInput } from "@/components/ui";
import { addClient } from "@/modules/clients";
import { suggestServices, WALL_CONDITIONS } from "@/modules/catalog";
import { previewQuote, saveQuote, updateQuote } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import type { Adjustment, Db, Opening, Quote, QuoteInput, Room, Visit } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtNum, UNIT_LABEL } from "@/shared/format";

const TITLES = ["Cliente", "Ambientes", "Serviços", "Materiais", "Preço", "Revisão"];

const door = (qty: number): Opening => ({ kind: "door", widthM: 0.8, heightM: 2.1, qty, deductFromArea: true, protectPerimeter: true });
const win = (qty: number): Opening => ({ kind: "window", widthM: 1.2, heightM: 1.0, qty, deductFromArea: true, protectPerimeter: true });

interface RoomForm { name: string; lengthM: number; widthM: number; heightM: number; condition: string; doors: number; windows: number }
const EMPTY_ROOM: RoomForm = { name: "", lengthM: 0, widthM: 0, heightM: 2.7, condition: "pintada", doors: 1, windows: 1 };

export default function NovoOrcamentoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NovoOrcamento />
    </Suspense>
  );
}

function NovoOrcamento() {
  const db = useAppDb();
  const params = useSearchParams();
  if (!db) return <Loading />;
  const quote = db.quotes.find((q) => q.id === params.get("editar"));
  const visit = db.visits.find((v) => v.id === (params.get("visita") ?? quote?.visitId));
  return <Wizard key={quote?.id ?? visit?.id ?? "novo"} db={db} quote={quote} visit={visit} />;
}

/** Monta ou edita um orçamento. Com `quote`, abre os dados dele para alterar. */
function Wizard({ db, quote, visit }: { db: Db; quote?: Quote; visit?: Visit }) {
  const router = useRouter();
  const [step, setStep] = useState(quote || visit ? 1 : 0);
  const [pickedClient, setClientId] = useState("");
  const clientId = pickedClient || quote?.clientId || visit?.clientId || "";
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "" });
  const [site, setSite] = useState(quote?.siteAddress ?? "");
  const [rooms, setRooms] = useState<Room[]>(quote?.input.rooms ?? []);
  const [form, setForm] = useState<RoomForm>(EMPTY_ROOM);
  const [included, setIncluded] = useState<Record<string, boolean>>(quote?.input.materialsIncluded ?? {});
  const [yields, setYields] = useState<Record<string, number>>(quote?.input.yieldOverrides ?? {});
  const [adj, setAdj] = useState<Adjustment>(quote?.input.adjustment ?? { type: "discount", mode: "percent", value: 0 });
  const [payment, setPayment] = useState<string | null>(quote?.paymentTerms ?? null);
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [showRoomPrices, setShowRoomPrices] = useState(quote?.showRoomPrices ?? false);
  const [paymentLink, setPaymentLink] = useState(quote?.paymentLink ?? "");
  const [depositPct, setDepositPct] = useState(quote?.depositPct ?? db.company?.depositPct ?? 50);

  const input: QuoteInput = useMemo(
    () => ({ rooms, extras: [], materialsIncluded: included, yieldOverrides: yields, adjustment: adj }),
    [rooms, included, yields, adj],
  );
  const result = useMemo(() => (rooms.length ? previewQuote(input, db) : null), [db, input, rooms.length]);
  const enabled = db.enabledServiceIds;

  const addRoom = () => {
    const openings = [...(form.doors ? [door(form.doors)] : []), ...(form.windows ? [win(form.windows)] : [])];
    const services = suggestServices(form.condition, enabled).map((serviceId) => ({ serviceId }));
    const extra = ["pintura_teto", ...(form.doors ? ["portas"] : []), ...(form.windows ? ["janelas"] : [])].filter((s) => enabled.includes(s));
    services.push(...extra.map((serviceId) => ({ serviceId })));
    setRooms([...rooms, { id: crypto.randomUUID(), name: form.name || `Ambiente ${rooms.length + 1}`, lengthM: form.lengthM, widthM: form.widthM, heightM: form.heightM, wallCondition: form.condition, openings, services }]);
    setForm({ ...EMPTY_ROOM, condition: form.condition, heightM: form.heightM });
  };

  const toggleService = (roomId: string, serviceId: string) =>
    setRooms(rooms.map((r) => r.id !== roomId ? r : { ...r, services: r.services.some((s) => s.serviceId === serviceId) ? r.services.filter((s) => s.serviceId !== serviceId) : [...r.services, { serviceId }] }));
  const patchSel = (roomId: string, serviceId: string, patch: { coats?: number; quantityOverride?: number }) =>
    setRooms(rooms.map((r) => r.id !== roomId ? r : { ...r, services: r.services.map((s) => s.serviceId === serviceId ? { ...s, ...patch } : s) }));

  const chosenClient = db.clients.find((c) => c.id === clientId);
  const siteValue = site || visit?.siteAddress || chosenClient?.address || "";
  const canNext = [
    (clientId || newClient.name.trim()) && true,
    rooms.length > 0,
    (result?.serviceLines.length ?? 0) > 0,
    true,
    true,
    true,
  ][step];

  const goNext = () => {
    if (step === 0 && !clientId) {
      const c = addClient(newClient);
      setClientId(c.id);
      if (!site) setSite(c.address);
    } else if (step === 0 && !site) setSite(chosenClient?.address ?? "");
    setStep(step + 1);
  };

  const save = () => {
    const paymentTerms = payment ?? db.company!.paymentTerms;
    if (quote) {
      updateQuote(db, quote.id, { siteAddress: siteValue, input, paymentTerms, notes, showRoomPrices, paymentLink: paymentLink.trim() || undefined, depositPct });
      router.replace(`/orcamentos/${quote.id}`);
      return;
    }
    const id = saveQuote(db, { clientId, visitId: visit?.id, siteAddress: siteValue, input, paymentTerms, notes, showRoomPrices, paymentLink: paymentLink.trim() || undefined, depositPct });
    router.replace(`/orcamentos/${id}`);
  };

  const t = result?.totals;
  return (
    <Screen title={`${step + 1}/${TITLES.length} · ${TITLES[step]}`} back={quote ? `/orcamentos/${quote.id}` : "/orcamentos"}>
      {quote ? (
        <div className="rounded-2xl border border-brand/25 bg-brand-soft p-3 text-sm">
          <b>Editando o orçamento nº {quote.number}.</b> Os preços serão recalculados com os valores atuais dos Ajustes, e a validade de 7 dias recomeça.
        </div>
      ) : null}
      {visit && step >= 1 && step <= 3 && (visit.notes || visit.photoIds.length > 0 || (visit.audios ?? []).length > 0) ? (
        <details className="rounded-2xl border border-brand/25 bg-brand-soft p-3" open={step === 1}>
          <summary className="cursor-pointer text-base font-semibold">Suas anotações da visita</summary>
          {visit.notes ? <p className="mt-2 whitespace-pre-wrap">{visit.notes}</p> : null}
          <div className="mt-2"><PhotoGrid ids={visit.photoIds} /></div>
          <AudioList audios={visit.audios ?? []} />
        </details>
      ) : null}

      {step === 0 && (
        <>
          {db.clients.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Escolha um cliente</p>
              <div className="flex flex-wrap gap-2">
                {db.clients.map((c) => <Chip key={c.id} active={clientId === c.id} onClick={() => setClientId(clientId === c.id ? "" : c.id)}>{c.name}</Chip>)}
              </div>
              <p className="pt-2 font-medium">ou cadastre um novo</p>
            </div>
          )}
          {!clientId && (
            <Card className="flex flex-col gap-3">
              <Field label="Nome do cliente"><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
              <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
              <Field label="Endereço da obra"><TextInput value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} /></Field>
            </Card>
          )}
          {clientId && <Field label="Endereço da obra"><TextInput value={siteValue} onChange={(e) => setSite(e.target.value)} /></Field>}
        </>
      )}

      {step === 1 && (
        <>
          {rooms.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div><b>{r.name}</b><div className="text-sm text-slate-600">{fmtNum(r.lengthM)} × {fmtNum(r.widthM)} m, altura {fmtNum(r.heightM)} m</div></div>
              <button className="h-11 w-11 rounded-full bg-slate-100" onClick={() => setRooms(rooms.filter((x) => x.id !== r.id))} aria-label="Remover">✕</button>
            </Card>
          ))}
          <Card className="flex flex-col gap-3">
            <b>{rooms.length ? "Adicionar outro ambiente" : "Primeiro ambiente"}</b>
            <Field label="Nome"><TextInput placeholder="Ex.: Sala" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Comprim. (m)"><NumberInput value={form.lengthM} onChange={(n) => setForm({ ...form, lengthM: n })} /></Field>
              <Field label="Largura (m)"><NumberInput value={form.widthM} onChange={(n) => setForm({ ...form, widthM: n })} /></Field>
              <Field label="Altura (m)"><NumberInput value={form.heightM} onChange={(n) => setForm({ ...form, heightM: n })} /></Field>
            </div>
            <div>
              <p className="mb-2 font-medium">Como estão as paredes?</p>
              <div className="flex flex-wrap gap-2">{WALL_CONDITIONS.map((w) => <Chip key={w.id} active={form.condition === w.id} onClick={() => setForm({ ...form, condition: w.id })}>{w.label}</Chip>)}</div>
            </div>
            <div className="flex items-center justify-between"><span>Portas</span><Stepper value={form.doors} onChange={(n) => setForm({ ...form, doors: n })} /></div>
            <div className="flex items-center justify-between"><span>Janelas</span><Stepper value={form.windows} onChange={(n) => setForm({ ...form, windows: n })} /></div>
            <Button variant="ghost" disabled={form.lengthM <= 0 || form.widthM <= 0 || form.heightM <= 0} onClick={addRoom}>+ Adicionar ambiente</Button>
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-slate-600">Já sugerimos os serviços pelo estado da parede. Toque para incluir ou tirar.</p>
          {rooms.map((r, i) => {
            const m = result?.measures[i];
            return (
              <Card key={r.id} className="flex flex-col gap-3">
                <div><b>{r.name}</b>{m ? <div className="text-sm text-slate-600">Paredes {fmtNum(m.wallsNetM2)} m² · Teto {fmtNum(m.ceilingM2)} m²</div> : null}</div>
                <div className="flex flex-wrap gap-2">
                  {db.services.filter((s) => enabled.includes(s.id)).map((s) => (
                    <Chip key={s.id} active={r.services.some((x) => x.serviceId === s.id)} onClick={() => toggleService(r.id, s.id)}>{s.name}</Chip>
                  ))}
                </div>
                {r.services.map((sel) => {
                  const svc = db.services.find((s) => s.id === sel.serviceId);
                  if (!svc) return null;
                  return (
                    <div key={sel.serviceId} className="flex items-center justify-between gap-2 text-sm">
                      <span>{svc.name}</span>
                      {svc.basis === "fixed" ? (
                        <div className="w-28"><NumberInput value={sel.quantityOverride ?? 1} onChange={(n) => patchSel(r.id, sel.serviceId, { quantityOverride: n })} /></div>
                      ) : svc.usesCoats ? (
                        <div className="flex items-center gap-2"><span>demãos</span><Stepper min={1} max={5} value={sel.coats ?? svc.defaultCoats} onChange={(n) => patchSel(r.id, sel.serviceId, { coats: n })} /></div>
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </>
      )}

      {step === 3 && result && (
        <>
          <p className="text-slate-600">Quantidade calculada automaticamente. Desmarque o que o cliente vai fornecer; edite o rendimento se precisar.</p>
          {result.materialLines.length === 0 ? <p>Nenhum material necessário.</p> : null}
          {result.materialLines.map((m) => (
            <Card key={m.materialId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div><b>{m.name}</b><div className="text-sm text-slate-600">Comprar {fmtNum(m.purchaseQty)} {m.unit} · {formatBRL(m.costCents)}</div></div>
                <Chip active={m.included} onClick={() => setIncluded({ ...included, [m.materialId]: !m.included })}>{m.included ? "Incluso" : "Cliente fornece"}</Chip>
              </div>
              <Field label={`Rendimento (cobre ${UNIT_LABEL.m2} por ${m.unit})`}>
                <NumberInput value={m.yieldUsed} onChange={(n) => setYields({ ...yields, [m.materialId]: n > 0 ? n : m.yieldUsed })} />
              </Field>
            </Card>
          ))}
        </>
      )}

      {step === 4 && t && (
        <>
          <Card className="flex flex-col gap-1">
            <div className="flex justify-between"><span>Serviços</span><span>{formatBRL(t.servicesCents)}</span></div>
            <div className="flex justify-between"><span>Materiais</span><span>{formatBRL(t.materialsCents)}</span></div>
            <div className="flex justify-between font-bold"><span>Subtotal</span><span>{formatBRL(t.subtotalCents)}</span></div>
          </Card>
          <Card className="flex flex-col gap-3">
            <b>Desconto ou acréscimo</b>
            <div className="flex gap-2">
              <Chip active={adj.type === "discount"} onClick={() => setAdj({ ...adj, type: "discount" })}>Desconto</Chip>
              <Chip active={adj.type === "surcharge"} onClick={() => setAdj({ ...adj, type: "surcharge" })}>Acréscimo</Chip>
            </div>
            <div className="flex gap-2">
              <Chip active={adj.mode === "percent"} onClick={() => setAdj({ ...adj, mode: "percent", value: 0 })}>%</Chip>
              <Chip active={adj.mode === "cents"} onClick={() => setAdj({ ...adj, mode: "cents", value: 0 })}>R$</Chip>
            </div>
            <NumberInput value={adj.mode === "cents" ? adj.value / 100 : adj.value} onChange={(n) => setAdj({ ...adj, value: adj.mode === "cents" ? Math.round(n * 100) : n })} />
          </Card>
          <Field label="Condição de pagamento"><TextInput value={payment ?? db.company!.paymentTerms} onChange={(e) => setPayment(e.target.value)} /></Field>
          <Field label="Observações (opcional)" hint="Aparecem no PDF, na página de combinados."><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Card className="flex flex-col gap-3">
            <b>No PDF do cliente</b>
            <div className="flex items-center justify-between gap-3">
              <span>Mostrar o valor de cada ambiente</span>
              <Chip active={showRoomPrices} onClick={() => setShowRoomPrices(!showRoomPrices)}>{showRoomPrices ? "Sim" : "Não"}</Chip>
            </div>
            <Field label="Link para o cliente pagar a entrada (opcional)" hint="Cole o link de pagamento (Pix, cartão) que você já usa. Sem link, o botão de pagar não aparece.">
              <TextInput type="url" inputMode="url" placeholder="https://" value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
            </Field>
            {paymentLink.trim() ? <Field label="Entrada (% do valor total)"><NumberInput value={depositPct} onChange={(n) => setDepositPct(Math.min(100, Math.max(1, n || 50)))} /></Field> : null}
          </Card>
        </>
      )}

      {step === 5 && t && result && (
        <>
          <Card>
            <div className="text-sm text-slate-600">Preço para o cliente</div>
            <div className="text-4xl font-bold text-brand">{formatBRL(t.totalCents)}</div>
            <div className="text-slate-600">Prazo: {result.schedule.workDays} dia(s) de trabalho + {result.schedule.safetyDays} de segurança</div>
          </Card>
          <Card className="border-amber-300 bg-amber-50">
            <b>Só para você</b>
            <div>Custo estimado: {formatBRL(t.costCents)}</div>
            <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
          </Card>
          {result.warnings.length > 0 && (
            <Card className="border-slate-300 bg-slate-50 text-sm text-slate-700">
              <b>Avisos</b>
              <ul className="list-disc pl-5">{result.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>
              <Link2 />
            </Card>
          )}
          <Button variant="success" onClick={save}>{quote ? "Salvar alterações" : "Salvar orçamento"}</Button>
        </>
      )}

      {step < 5 && (
        <div className="mt-auto flex gap-3 pt-4">
          {step > (quote ? 1 : 0) && <Button variant="ghost" className="w-28" onClick={() => setStep(step - 1)}>Voltar</Button>}
          <Button disabled={!canNext} onClick={goNext}>Continuar</Button>
        </div>
      )}
      {step === 5 && <Button variant="ghost" onClick={() => setStep(4)}>Voltar</Button>}
    </Screen>
  );
}

function Link2() {
  return <a href="/configuracoes" className="mt-2 block text-brand underline">Conferir valores em Ajustes</a>;
}
