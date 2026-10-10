"use client";
import { initialPayment, PaymentOptionsField, payLinkValue, type PaymentChoice } from "@/components/PaymentOptionsField";
import { MaterialsField } from "@/components/MaterialsField";
import { openVisitFor, VisitSuggestion } from "@/components/VisitSuggestion";
import { DictationField } from "@/components/DictationField";
import { AddressInput } from "@/components/AddressInput";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PhotoGrid } from "@/components/PhotoGrid";
import { AudioList } from "@/components/AudioList";
import { BlocoRecolhivel, Button, Card, Chip, Field, Loading, NumberInput, Screen, Stepper, TextInput } from "@/components/ui";
import { Copy, Eye, EyeOff, Home, Settings, X, Plus, Check } from "lucide-react";
import { addClient } from "@/modules/clients";
import { PriceCheck } from "@/components/PriceCheck";
import { ServicePicker } from "@/components/ServicePicker";
import { RoomEditor } from "@/components/RoomEditor";
import { applyDraft, blankRoom, cloneSurfaces, draftOf, legacyToSurfaces, openingCount, surfacesSummary, visitRoomToRoom, type RoomDraft } from "@/modules/rooms";
import { isPriceOnly, previewQuote, saveQuote, updateQuote } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
import { isSimpleMode } from "@/modules/settings";
import { SimpleQuoteForm } from "@/components/SimpleQuoteForm";
import { QuoteModeFirstAsk } from "@/components/QuoteModeFirstAsk";
import type { Adjustment, Db, Quote, QuoteInput, Room, Visit } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtNum, plural, UNIT_LABEL } from "@/shared/format";

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
  if (db.company && db.company.quoteModeAsked === false && !quote) return <QuoteModeFirstAsk company={db.company} />;
  if (isSimpleMode(db.company) && (!quote || isPriceOnly(quote))) return <SimpleQuoteForm key={quote?.id ?? visit?.id ?? "novo"} db={db} quote={quote} visit={visit} />;
  return <Wizard key={quote?.id ?? visit?.id ?? "novo"} db={db} quote={quote} visit={visit} />;
}

/** Monta ou edita um orçamento. Com `quote`, abre os dados dele para alterar. */
function Wizard({ db, quote, visit }: { db: Db; quote?: Quote; visit?: Visit }) {
  const router = useRouter();
  const [pickedClient, setClientId] = useState<string | null>(null);
  const clientId = pickedClient ?? quote?.clientId ?? visit?.clientId ?? "";
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: visit?.siteAddress ?? "" });
  const [site, setSite] = useState(quote?.siteAddress ?? "");
  const [rooms, setRooms] = useState<Room[]>(() => quote?.input.rooms ?? (visit?.rooms ?? []).map((r) => visitRoomToRoom(r, db.enabledServiceIds)));
  const [draft, setDraft] = useState<RoomDraft>(() => { const b = blankRoom(1); return { name: b.name, surfaces: b.surfaces!, doors: b.doors, windows: b.windows }; });
  const [showForm, setShowForm] = useState(false);
  /** Ambiente do orçamento aberto para mexer nas medidas. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [included, setIncluded] = useState<Record<string, boolean>>(quote?.input.materialsIncluded ?? {});
  const [yields, setYields] = useState<Record<string, number>>(quote?.input.yieldOverrides ?? {});
  const [adj, setAdj] = useState<Adjustment>((quote && !isPriceOnly(quote) ? quote.input.adjustment : undefined) ?? { type: "discount", mode: "percent", value: 0 });
  const [payment, setPayment] = useState<string | null>(quote?.paymentTerms ?? null);
  const [notes, setNotes] = useState(quote?.notes ?? visit?.notes ?? "");
  const [materials, setMaterials] = useState(quote?.materialsText ?? "");
  const [showMaterials, setShowMaterials] = useState(quote?.showMaterials ?? false);
  const [usedVisit, setUsedVisit] = useState<Visit | null>(null);
  const [showRoomPrices, setShowRoomPrices] = useState(quote?.showRoomPrices ?? false);
  const [pay, setPay] = useState<PaymentChoice>(() => initialPayment(db.company, quote));

  const enabled = db.enabledServiceIds;
  const formOpen = rooms.length === 0 || showForm;
  // O ambiente que está sendo digitado já entra no preço, sem precisar tocar em "Adicionar".
  const pending = useMemo(
    () => (formOpen && !editingId && draft.surfaces.some((s) => s.widthM > 0 && s.heightM > 0)
      ? visitRoomToRoom({ id: "pendente", name: draft.name.trim() || `Ambiente ${rooms.length + 1}`, lengthM: 0, widthM: 0, heightM: 2.7, condition: "pintada", doors: draft.doors, windows: draft.windows, surfaces: draft.surfaces }, enabled)
      : null),
    [formOpen, editingId, draft, enabled, rooms.length],
  );
  const allRooms = useMemo(() => (pending ? [...rooms, pending] : rooms), [rooms, pending]);
  const input: QuoteInput = useMemo(
    () => ({ rooms: allRooms, extras: [], materialsIncluded: included, yieldOverrides: yields, adjustment: adj }),
    [allRooms, included, yields, adj],
  );
  const result = useMemo(() => (allRooms.length ? previewQuote(input, db) : null), [db, input, allRooms.length]);
  const freshDraft = (n: number): RoomDraft => { const b = blankRoom(n); return { name: b.name, surfaces: b.surfaces!, doors: b.doors, windows: b.windows }; };
  const addRoom = () => {
    setRooms([...rooms, { ...pending!, id: crypto.randomUUID() }]);
    setDraft(freshDraft(rooms.length + 2));
  };
  const openEdit = (r: Room) => {
    const d = draftOf(r);
    setDraft(d.surfaces.length ? d : { ...d, surfaces: legacyToSurfaces(r.lengthM, r.widthM, r.heightM) });
    setEditingId(r.id);
  };
  const saveEdit = () => { setRooms(rooms.map((r) => (r.id === editingId ? applyDraft(r.surfaces?.length ? r : { ...r, lengthM: 0, widthM: 0 }, draft, enabled) : r))); setEditingId(null); setDraft(freshDraft(rooms.length + 1)); };

  const toggleService = (roomId: string, serviceId: string) =>
    setRooms(rooms.map((r) => r.id !== roomId ? r : { ...r, services: r.services.some((s) => s.serviceId === serviceId) ? r.services.filter((s) => s.serviceId !== serviceId) : [...r.services, { serviceId }] }));
  const patchSel = (roomId: string, serviceId: string, patch: { coats?: number; quantityOverride?: number }) =>
    setRooms(rooms.map((r) => r.id !== roomId ? r : { ...r, services: r.services.map((s) => s.serviceId === serviceId ? { ...s, ...patch } : s) }));

  const chosenClient = db.clients.find((c) => c.id === clientId);
  const siteValue = site || visit?.siteAddress || chosenClient?.address || newClient.address || "";
  const suggestion = !visit && !quote && !usedVisit && chosenClient ? openVisitFor(db, chosenClient.id) : undefined;
  const hasClient = !!clientId || !!newClient.name.trim();
  const hasServices = (result?.serviceLines.length ?? 0) > 0;
  const canSave = hasClient && allRooms.length > 0 && hasServices;
  const missing = [!hasClient && "o cliente", allRooms.length === 0 && "um ambiente (preencha as medidas)", allRooms.length > 0 && !hasServices && "um serviço"].filter(Boolean).join(" e ");

  const save = () => {
    const paymentTerms = payment ?? db.company!.paymentTerms;
    const finalInput: QuoteInput = pending ? { ...input, rooms: [...rooms, { ...pending, id: crypto.randomUUID() }] } : input;
    if (quote) {
      updateQuote(db, quote.id, { siteAddress: siteValue, input: finalInput, paymentTerms, notes, showRoomPrices, materialsText: materials, showMaterials, paymentLink: payLinkValue(pay), depositPct: pay.pct, payPix: pay.pix, payCard: pay.card });
      router.replace(`/orcamentos/${quote.id}`);
      return;
    }
    const cid = clientId || addClient({ ...newClient, address: newClient.address || siteValue }).id;
    const id = saveQuote(db, { clientId: cid, visitId: visit?.id ?? usedVisit?.id, siteAddress: siteValue, input: finalInput, paymentTerms, notes, showRoomPrices, materialsText: materials, showMaterials, paymentLink: payLinkValue(pay), depositPct: pay.pct, payPix: pay.pix, payCard: pay.card });
    router.replace(`/orcamentos/${id}`);
  };

  const t = result?.totals;
  // Serviços com preço de exemplo já têm o bloco "Confirme seus preços"; aqui só entram os outros avisos (materiais de exemplo viram uma linha).
  const demoServices = db.services.filter((sv) => sv.isDemo && allRooms.some((r) => r.services.some((x) => x.serviceId === sv.id)));
  const demoMatch = (w: string): string | undefined => w.match(/^"(.+)" usa valores de demonstração\.$/)?.[1];
  const shownDemo = new Set(demoServices.map((sv) => sv.name));
  const demoMaterials = (result?.warnings ?? []).map(demoMatch).filter((n): n is string => !!n && !shownDemo.has(n));
  const notes2 = [...(demoMaterials.length ? [`Materiais com preço de exemplo: ${demoMaterials.join(", ")}. Confira em Ajustes → Materiais.`] : []), ...(result?.warnings ?? []).filter((w) => !demoMatch(w))];
  return (
    <Screen title={quote ? `Editar orçamento nº ${quote.number}` : "Orçamento"} back={quote ? `/orcamentos/${quote.id}` : visit ? `/visitas/${visit.id}` : "/orcamentos"}>
      <div className="flex flex-col gap-4 pb-36">
        {quote ? (
          <div className="rounded-2xl border border-brand/25 bg-brand-soft p-3 text-base">
            Os preços serão recalculados com os valores atuais dos Ajustes, e a validade de 7 dias recomeça.
          </div>
        ) : null}
        {visit && (visit.notes || visit.photoIds.length > 0 || (visit.audios ?? []).length > 0) ? (
          <details className="rounded-2xl border border-brand/25 bg-brand-soft p-3" open={rooms.length === 0}>
            <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">Suas anotações da visita</summary>
            {visit.notes ? <p className="mt-2 whitespace-pre-wrap">{visit.notes}</p> : null}
            <div className="mt-2"><PhotoGrid ids={visit.photoIds} marksOf={(pid) => visit.photoMeta?.[pid]?.marks} /></div>
            <AudioList audios={visit.audios ?? []} />
          </details>
        ) : null}

        <div>
        <Card className="flex flex-col gap-3">
          <b>Cliente</b>
          {chosenClient ? (
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-lg font-semibold">{chosenClient.name}</div>{chosenClient.phone ? <div className="text-support">{chosenClient.phone}</div> : null}</div>
              {!quote ? <button className="min-h-12 px-2 font-display text-lg font-semibold text-live" onClick={() => setClientId("")}>Trocar</button> : null}
            </div>
          ) : (
            <>
              {db.clients.length > 0 ? <div className="flex flex-wrap gap-2">{db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => setClientId(c.id)}>{c.name}</Chip>)}</div> : null}
              <Field label={db.clients.length > 0 ? "Ou cliente novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
              <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            </>
          )}
          <VisitSuggestion visit={suggestion} onUse={(v) => { setUsedVisit(v); if (!siteValue && v.siteAddress) setSite(v.siteAddress); if (!notes.trim() && v.notes) setNotes(v.notes); }} />
          <AddressInput label="Endereço da obra" value={siteValue} onChange={(t) => { setSite(t); setNewClient((n) => ({ ...n, address: t })); }} />
        </Card>
        </div>

        <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-medium leading-[26px]">Ambientes e serviços</h2>
        {rooms.map((r, i) => {
          const m = result?.measures[i];
          return (
            <BlocoRecolhivel
              key={r.id}
              title={r.name}
              icon={Home}
              summary={`${m ? `${(m.wallsNetM2 + m.ceilingM2 + m.floorM2).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²` : "— m²"} · ${plural(r.services.length, "serviço", "serviços")}`}
              openWhen={editingId === r.id}
              action={editingId === r.id ? undefined : { label: "Editar medidas", opens: true, onClick: () => openEdit(r) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-base text-support">{r.surfaces?.length ? surfacesSummary(r.surfaces, openingCount(r, "door"), openingCount(r, "window")) : `${fmtNum(r.lengthM)} × ${fmtNum(r.widthM)} m, altura ${fmtNum(r.heightM)} m${m ? ` · paredes ${fmtNum(m.wallsNetM2)} m² · teto ${fmtNum(m.ceilingM2)} m²` : ""}`}</div>
                <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F3F6FA]" onClick={() => setRooms(rooms.filter((x) => x.id !== r.id))} aria-label={`Remover ${r.name}`}><X size={20} strokeWidth={2.4} aria-hidden /></button>
              </div>
              {editingId === r.id ? null : <Button variant="ghost" size="sm" icon={Copy} onClick={() => setRooms([...rooms, { ...r, id: crypto.randomUUID(), name: `${r.name} (cópia)`, surfaces: r.surfaces ? cloneSurfaces(r.surfaces) : r.surfaces, services: r.services.map((x) => ({ ...x })) }])}>Duplicar ambiente</Button>}
              {editingId === r.id ? (
                <RoomEditor title="Medidas do ambiente" draft={draft} onChange={setDraft} onSave={saveEdit} onCancel={() => setEditingId(null)} saveLabel="Salvar medidas" />
              ) : null}
              <ServicePicker services={db.services.filter((sv) => enabled.includes(sv.id))} selected={r.services.map((x) => x.serviceId)} onToggle={(id) => toggleService(r.id, id)} />
              {r.services.some((sel) => { const svc = db.services.find((x) => x.id === sel.serviceId); return svc && (svc.basis === "fixed" || svc.usesCoats); }) ? (
                <details>
                  <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold text-brand">Demãos (camadas de tinta) e quantidades</summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {r.services.map((sel) => {
                      const svc = db.services.find((x) => x.id === sel.serviceId);
                      if (!svc) return null;
                      return (
                        <div key={sel.serviceId} className="flex items-center justify-between gap-2 text-base">
                          <span>{svc.name}</span>
                          {svc.basis === "fixed" ? (
                            <div className="w-28"><NumberInput value={sel.quantityOverride ?? 1} onChange={(n) => patchSel(r.id, sel.serviceId, { quantityOverride: n })} /></div>
                          ) : svc.usesCoats ? (
                            <div className="flex items-center gap-2"><span>demãos</span><Stepper min={1} max={5} value={sel.coats ?? svc.defaultCoats} onChange={(n) => patchSel(r.id, sel.serviceId, { coats: n })} /></div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </BlocoRecolhivel>
          );
        })}
        </div>
        {formOpen ? (
          <>
            {editingId ? null : <RoomEditor title={rooms.length ? "Novo ambiente" : "Primeiro ambiente"} draft={draft} onChange={setDraft} onSave={() => { addRoom(); setShowForm(false); }} saveLabel="Adicionar ambiente" />}
            {pending && !editingId ? <p className="-mt-2 text-base text-support">Este ambiente já está no preço. Toque em <b>Adicionar ambiente</b> para guardar e escolher os serviços dele.</p> : null}
          </>
        ) : (
          <Button variant="ghost" icon={Plus} onClick={() => setShowForm(true)}>Adicionar ambiente</Button>
        )}
        <PriceCheck services={demoServices} />

        <BlocoRecolhivel title="Ajustes do orçamento (opcional)" icon={Settings}>
          <div className="flex flex-col gap-4">
            {result && result.materialLines.length > 0 ? (
              <div className="flex flex-col gap-2">
                <b>Materiais</b>
                <p className="text-base text-support">Quantidade calculada sozinha. Desmarque o que o cliente vai fornecer.</p>
                {result.materialLines.map((m) => (
                  <Card key={m.materialId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div><b>{m.name}</b><div className="text-base text-support">Comprar {fmtNum(m.purchaseQty)} {m.unit} · {formatBRL(m.costCents)}</div></div>
                      <Chip active={m.included} onClick={() => setIncluded({ ...included, [m.materialId]: !m.included })}>{m.included ? "Incluso" : "Cliente fornece"}</Chip>
                    </div>
                    <Field label={`Rendimento (cobre ${UNIT_LABEL.m2} por ${m.unit})`} help="Quanto 1 unidade do material cobre. Se o seu material rende mais ou menos que o padrão, ajuste aqui e a quantidade a comprar muda.">
                      <NumberInput value={m.yieldUsed} onChange={(n) => setYields({ ...yields, [m.materialId]: n > 0 ? n : m.yieldUsed })} />
                    </Field>
                  </Card>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <b className="text-lg">Desconto ou acréscimo</b>
              <div className="flex flex-wrap gap-2">
                <Chip active={adj.type === "discount"} onClick={() => setAdj({ ...adj, type: "discount" })}>Desconto</Chip>
                <Chip active={adj.type === "surcharge"} onClick={() => setAdj({ ...adj, type: "surcharge" })}>Acréscimo</Chip>
                <Chip active={adj.mode === "percent"} onClick={() => setAdj({ ...adj, mode: "percent", value: 0 })}>%</Chip>
                <Chip active={adj.mode === "cents"} onClick={() => setAdj({ ...adj, mode: "cents", value: 0 })}>R$</Chip>
              </div>
              <NumberInput value={adj.mode === "cents" ? adj.value / 100 : adj.value} onChange={(n) => setAdj({ ...adj, value: adj.mode === "cents" ? Math.round(n * 100) : n })} />
            </div>
            <Field label="Condição de pagamento"><TextInput value={payment ?? db.company!.paymentTerms} onChange={(e) => setPayment(e.target.value)} /></Field>
            <DictationField label="Observações para o cliente (opcional)" hint="Só deste orçamento: a cor escolhida, o que ficou combinado a mais. Aparecem no PDF e no link. Garantia e o que não está incluso você ajusta uma vez em Ajustes." value={notes} onChange={setNotes} />
            <MaterialsField text={materials} onText={setMaterials} show={showMaterials} onShow={setShowMaterials} />
            <div className="flex flex-col gap-3">
              <b>No PDF do cliente</b>
              <div className="flex items-center justify-between gap-3">
                <span>Mostrar o valor de cada ambiente</span>
                <Chip active={showRoomPrices} onClick={() => setShowRoomPrices(!showRoomPrices)}>{showRoomPrices ? "Sim" : "Não"}</Chip>
              </div>
            </div>
            <PaymentOptionsField company={db.company} value={pay} onChange={setPay} />
          </div>
        </BlocoRecolhivel>

        {notes2.length > 0 ? (
          <details className="rounded-[20px] border border-line bg-white p-4 text-base text-ink">
            <summary className="flex min-h-12 cursor-pointer items-center font-display font-semibold">Avisos ({notes2.length})</summary>
            <ul className="mt-2 list-disc pl-5">{notes2.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>
            <a href="/configuracoes" className="flex min-h-12 items-center font-display font-semibold text-live">Conferir valores em Ajustes</a>
          </details>
        ) : null}

        {t ? (
          <>
            <div><Button variant="ghost" icon={showCost ? EyeOff : Eye} aria-expanded={showCost} onClick={() => setShowCost((o) => !o)}>{showCost ? "Esconder meu custo e lucro" : "Ver meu custo e lucro"}</Button></div>
            {showCost ? (
              <div className="rounded-[20px] bg-[#FFF3D6] p-4 text-lg leading-[26px] text-[#8A4B00]">
                <b className="font-display font-semibold">Só para você</b>
                <div>Custo estimado: {formatBRL(t.costCents)}</div>
                <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-line bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-base text-support">Preço para o cliente</div>
          <div className="font-display text-[40px] font-semibold leading-[44px] text-brand" data-testid="total">{t ? formatBRL(t.totalCents) : "—"}</div>
          {demoServices.length > 0 ? <div data-testid="preco-exemplo" className="my-0.5 w-fit rounded-full bg-[#FFF3D6] px-2.5 py-0.5 text-base font-semibold text-[#8A4B00]">Preços de exemplo: confirme</div> : null}
          <div className="text-base text-support">{canSave && result ? `Prazo: ${plural(result.schedule.workDays, "dia", "dias")} + ${result.schedule.safetyDays} de segurança` : missing ? `Falta ${missing}` : ""}</div>
        </div>
        <Button className="!w-auto shrink-0 !px-5" aria-label={quote ? undefined : "Salvar orçamento"} icon={Check} disabled={!canSave} onClick={save}>Salvar</Button>
      </div>
    </Screen>
  );
}
