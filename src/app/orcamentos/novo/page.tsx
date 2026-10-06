"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PhotoGrid } from "@/components/PhotoGrid";
import { AudioList } from "@/components/AudioList";
import { Button, Card, Chip, Field, Loading, NumberInput, Screen, Stepper, TextArea2, TextInput } from "@/components/ui";
import { Eye, EyeOff, Ruler, Settings, X } from "lucide-react";
import { addClient } from "@/modules/clients";
import { PriceCheck } from "@/components/PriceCheck";
import { AutoTour, type TourStep } from "@/components/Tour";
import { RoomEditor } from "@/components/RoomEditor";
import { applyDraft, blankRoom, draftOf, legacyToSurfaces, openingCount, surfacesSummary, visitRoomToRoom, type RoomDraft } from "@/modules/rooms";
import { previewQuote, saveQuote, updateQuote } from "@/modules/quotes";
import { useAppDb } from "@/modules/useApp";
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
  const [adj, setAdj] = useState<Adjustment>(quote?.input.adjustment ?? { type: "discount", mode: "percent", value: 0 });
  const [payment, setPayment] = useState<string | null>(quote?.paymentTerms ?? null);
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [showRoomPrices, setShowRoomPrices] = useState(quote?.showRoomPrices ?? false);
  const [paymentLink, setPaymentLink] = useState(quote?.paymentLink ?? "");
  const [depositPct, setDepositPct] = useState(quote?.depositPct ?? db.company?.depositPct ?? 50);

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
  const hasClient = !!clientId || !!newClient.name.trim();
  const hasServices = (result?.serviceLines.length ?? 0) > 0;
  const canSave = hasClient && allRooms.length > 0 && hasServices;
  const missing = [!hasClient && "o cliente", allRooms.length === 0 && "um ambiente (preencha as medidas)", allRooms.length > 0 && !hasServices && "um serviço"].filter(Boolean).join(" e ");

  const save = () => {
    const paymentTerms = payment ?? db.company!.paymentTerms;
    const finalInput: QuoteInput = pending ? { ...input, rooms: [...rooms, { ...pending, id: crypto.randomUUID() }] } : input;
    if (quote) {
      updateQuote(db, quote.id, { siteAddress: siteValue, input: finalInput, paymentTerms, notes, showRoomPrices, paymentLink: paymentLink.trim() || undefined, depositPct });
      router.replace(`/orcamentos/${quote.id}`);
      return;
    }
    const cid = clientId || addClient({ ...newClient, address: newClient.address || siteValue }).id;
    const id = saveQuote(db, { clientId: cid, visitId: visit?.id, siteAddress: siteValue, input: finalInput, paymentTerms, notes, showRoomPrices, paymentLink: paymentLink.trim() || undefined, depositPct });
    router.replace(`/orcamentos/${id}`);
  };

  const steps: TourStep[] = [
    { target: "orc-cliente", title: "Cliente e endereço", text: "Escolha um cliente que já existe ou cadastre um novo. Vindo de uma visita, o cliente e o endereço já vêm preenchidos." },
    { target: "orc-ambientes", title: "Ambientes e serviços", text: "As medidas da visita já estão aqui. Toque em Editar medidas para mudar, e marque os serviços de cada ambiente: lixar, massa, pintura e o que mais for fazer." },
    { target: "orc-ajustes", title: "Ajustes do orçamento", text: "Opcional: tinta inclusa ou do cliente, desconto, forma de pagamento e observações para o PDF." },
    { target: "orc-custo", title: "Seu custo e lucro", text: "Só você vê. Toque aqui para ver quanto custa a obra e quanto sobra de lucro. O cliente nunca vê." },
    { target: "orc-salvar", title: "Preço e salvar", text: "O preço para o cliente aparece na hora e muda conforme você mexe. Toque em Salvar para guardar. Depois você gera o PDF e manda no WhatsApp." },
  ];
  const t = result?.totals;
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
            <summary className="cursor-pointer text-base font-semibold">Suas anotações da visita</summary>
            {visit.notes ? <p className="mt-2 whitespace-pre-wrap">{visit.notes}</p> : null}
            <div className="mt-2"><PhotoGrid ids={visit.photoIds} marksOf={(pid) => visit.photoMeta?.[pid]?.marks} /></div>
            <AudioList audios={visit.audios ?? []} />
          </details>
        ) : null}

        <div data-tour="orc-cliente">
        <Card className="flex flex-col gap-3">
          <b>Cliente</b>
          {chosenClient ? (
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-lg font-semibold">{chosenClient.name}</div>{chosenClient.phone ? <div className="text-support">{chosenClient.phone}</div> : null}</div>
              {!quote ? <button className="min-h-10 px-2 text-brand underline" onClick={() => setClientId("")}>Trocar</button> : null}
            </div>
          ) : (
            <>
              {db.clients.length > 0 ? <div className="flex flex-wrap gap-2">{db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => setClientId(c.id)}>{c.name}</Chip>)}</div> : null}
              <Field label={db.clients.length > 0 ? "Ou cliente novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
              <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            </>
          )}
          <Field label="Endereço da obra"><TextArea2 value={siteValue} onChange={(e) => { setSite(e.target.value); setNewClient((n) => ({ ...n, address: e.target.value })); }} /></Field>
        </Card>
        </div>

        <div data-tour="orc-ambientes" className="flex flex-col gap-4">
        <h2 className="font-display text-[22px] font-bold leading-7">Ambientes e serviços</h2>
        {rooms.map((r, i) => {
          const m = result?.measures[i];
          return (
            <Card key={r.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <b className="text-lg">{r.name}</b>
                  <div className="text-base text-support">{r.surfaces?.length ? surfacesSummary(r.surfaces, openingCount(r, "door"), openingCount(r, "window")) : `${fmtNum(r.lengthM)} × ${fmtNum(r.widthM)} m, altura ${fmtNum(r.heightM)} m${m ? ` · paredes ${fmtNum(m.wallsNetM2)} m² · teto ${fmtNum(m.ceilingM2)} m²` : ""}`}</div>
                </div>
                <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100" onClick={() => setRooms(rooms.filter((x) => x.id !== r.id))} aria-label={`Remover ${r.name}`}><X size={20} strokeWidth={2.4} aria-hidden /></button>
              </div>
              {editingId === r.id ? (
                <RoomEditor title="Medidas do ambiente" draft={draft} onChange={setDraft} onSave={saveEdit} onCancel={() => setEditingId(null)} saveLabel="Salvar medidas" />
              ) : <Button variant="ghost" icon={Ruler} onClick={() => openEdit(r)}>Editar medidas</Button>}
              <div className="flex flex-wrap gap-2">
                {db.services.filter((sv) => enabled.includes(sv.id)).map((sv) => (
                  <Chip key={sv.id} active={r.services.some((x) => x.serviceId === sv.id)} onClick={() => toggleService(r.id, sv.id)}>{sv.name}</Chip>
                ))}
              </div>
              {r.services.some((sel) => { const svc = db.services.find((x) => x.id === sel.serviceId); return svc && (svc.basis === "fixed" || svc.usesCoats); }) ? (
                <details>
                  <summary className="cursor-pointer text-base font-semibold text-brand">Demãos e quantidades</summary>
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
            </Card>
          );
        })}
        </div>
        {formOpen ? (
          <>
            {editingId ? null : <RoomEditor title={rooms.length ? "Novo ambiente" : "Primeiro ambiente"} draft={draft} onChange={setDraft} onSave={() => { addRoom(); setShowForm(false); }} saveLabel="Adicionar ambiente" />}
            {pending && !editingId ? <p className="-mt-2 text-base text-support">Este ambiente já está no preço. Toque em <b>Adicionar ambiente</b> para guardar e escolher os serviços dele.</p> : null}
          </>
        ) : (
          <Button variant="ghost" onClick={() => setShowForm(true)}>+ Adicionar ambiente</Button>
        )}
        <PriceCheck services={db.services.filter((sv) => sv.isDemo && allRooms.some((r) => r.services.some((x) => x.serviceId === sv.id)))} />

        <details data-tour="orc-ajustes" className="rounded-2xl border border-slate-200 p-3">
          <summary className="flex cursor-pointer items-center gap-2 font-display text-lg font-bold"><Settings size={24} strokeWidth={2.2} aria-hidden className="text-brand" />Ajustes do orçamento (opcional)</summary>
          <div className="mt-3 flex flex-col gap-4">
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
                    <Field label={`Rendimento (cobre ${UNIT_LABEL.m2} por ${m.unit})`}>
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
            <Field label="Observações (opcional)" hint="Aparecem no PDF, na página de combinados."><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex flex-col gap-3">
              <b>No PDF do cliente</b>
              <div className="flex items-center justify-between gap-3">
                <span>Mostrar o valor de cada ambiente</span>
                <Chip active={showRoomPrices} onClick={() => setShowRoomPrices(!showRoomPrices)}>{showRoomPrices ? "Sim" : "Não"}</Chip>
              </div>
              <Field label="Link para o cliente pagar a entrada (opcional)" hint="Cole o link de pagamento (Pix, cartão) que você já usa. Sem link, o botão de pagar não aparece.">
                <TextInput type="url" inputMode="url" placeholder="https://" value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
              </Field>
              {paymentLink.trim() ? <Field label="Entrada (% do valor total)"><NumberInput value={depositPct} onChange={(n) => setDepositPct(Math.min(100, Math.max(1, n || 50)))} /></Field> : null}
            </div>
          </div>
        </details>

        {result && result.warnings.length > 0 ? (
          <details className="rounded-2xl border border-slate-300 bg-slate-50 p-3 text-base text-ink">
            <summary className="cursor-pointer font-semibold">Avisos ({result.warnings.length})</summary>
            <ul className="mt-2 list-disc pl-5">{result.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>
            <a href="/configuracoes" className="mt-2 block text-brand underline">Conferir valores em Ajustes</a>
          </details>
        ) : null}

        {t ? (
          <>
            <div data-tour="orc-custo"><Button variant="ghost" icon={showCost ? EyeOff : Eye} aria-expanded={showCost} onClick={() => setShowCost((o) => !o)}>{showCost ? "Esconder meu custo e lucro" : "Ver meu custo e lucro"}</Button></div>
            {showCost ? (
              <Card className="border-amber-300 bg-amber-50">
                <b>Só para você</b>
                <div>Custo estimado: {formatBRL(t.costCents)}</div>
                <div>Lucro estimado: {formatBRL(t.profitCents)} ({fmtNum(t.profitMargin * 100, 1)}%)</div>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      <div data-tour="orc-salvar" className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <div className="text-base text-support">Preço para o cliente</div>
          <div className="font-display text-[28px] font-extrabold leading-8 text-brand" data-testid="total">{t ? formatBRL(t.totalCents) : "—"}</div>
          <div className="text-base text-support">{canSave && result ? `Prazo: ${plural(result.schedule.workDays, "dia", "dias")} + ${result.schedule.safetyDays} de segurança` : missing ? `Falta ${missing}` : ""}</div>
        </div>
        <Button className="!w-auto shrink-0 !px-5" aria-label={quote ? undefined : "Salvar orçamento"} disabled={!canSave} onClick={save}>Salvar</Button>
      </div>
      <AutoTour id="orcamento" steps={steps} enabled={!quote} />
    </Screen>
  );
}
