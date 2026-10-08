"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Check, Trash2 } from "lucide-react";
import { Button, Card, Field, Loading, NumberInput, Screen, TextInput } from "@/components/ui";
import { cloudEnabled } from "@/modules/auth";
import { fmtClock, useRecorder } from "@/modules/audio";
import { describeDraft, discardVoice, processPendingVoice, queueVoice, quoteFromVoice, requestVoiceDraft, saveVoiceQuote, usePendingVoice, voiceFailureText, type PendingVoice, type VoiceDraft } from "@/modules/voice";
import { surfacesSummary } from "@/modules/rooms";
import { useAppDb } from "@/modules/useApp";
import { isSimpleMode } from "@/modules/settings";
import { formatBRL } from "@/shared/money";

/** Passa disso o áudio fica grande e caro: para sozinho. */
const MAX_SECONDS = 180;

type Phase = { name: "idle" } | { name: "sending" } | { name: "review"; draft: VoiceDraft; transcript: string; pendingId?: string } | { name: "error"; text: string } | { name: "queued" };

export default function OrcamentoPorVozPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrcamentoPorVoz />
    </Suspense>
  );
}

function OrcamentoPorVoz() {
  const db = useAppDb();
  const params = useSearchParams();
  /** Visita de onde o ditado começou; o orçamento sai ligado a ela e já sabe cliente e endereço. */
  const [visitId, setVisitId] = useState<string | undefined>(params.get("visita") ?? undefined);
  const visit = db?.visits.find((v) => v.id === visitId);
  const visitClient = visit?.clientId ? db?.clients.find((c) => c.id === visit.clientId) : undefined;
  const router = useRouter();
  const { state, seconds, start, stop } = useRecorder();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [fields, setFields] = useState({ clientName: "", phone: "", address: "", paymentTerms: "", notes: "" });
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const simple = isSimpleMode(db?.company);

  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef<() => Promise<void>>(async () => undefined);
  const begin = async () => {
    await start();
    autoStop.current = setTimeout(() => void finishRef.current(), MAX_SECONDS * 1000);
  };
  useEffect(() => () => { if (autoStop.current) clearTimeout(autoStop.current); }, []);

  const openReview = (draft: VoiceDraft, transcript: string, pendingId?: string, pendingVisitId?: string) => {
    const vid = pendingId ? pendingVisitId : visitId;
    setVisitId(vid);
    const v = db?.visits.find((x) => x.id === vid);
    const c = v?.clientId ? db?.clients.find((x) => x.id === v.clientId) : undefined;
    setFields({ clientName: c?.name ?? draft.clientName, phone: c?.phone ?? draft.phone, address: v?.siteAddress || c?.address || draft.address, paymentTerms: draft.paymentTerms, notes: draft.notes });
    setPrice(draft.closedPriceReais);
    setDescription(describeDraft(draft));
    setPhase({ name: "review", draft, transcript, pendingId });
  };

  const finish = async () => {
    if (autoStop.current) clearTimeout(autoStop.current);
    const out = await stop();
    if (!out) return;
    setPhase({ name: "sending" });
    const keep = async () => {
      try { await queueVoice(out.blob, out.seconds, visitId); setPhase({ name: "queued" }); }
      catch { setPhase({ name: "error", text: "Não consegui guardar o áudio neste aparelho. Libere espaço ou tente de novo com internet." }); }
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return keep();
    try {
      const { transcript, draft } = await requestVoiceDraft(out.blob);
      openReview(draft, transcript);
    } catch (e) {
      // Sem internet: guarda o áudio e processa quando a conexão voltar. Outros erros: o pintor decide.
      if (e instanceof Error && e.message === "network") return keep();
      setPhase({ name: "error", text: voiceFailureText(e instanceof Error ? e.message : "") });
    }
  };

  // Áudios guardados sem internet: processa sozinho quando a conexão volta (e ao abrir a tela).
  const pending = usePendingVoice();
  const busy = useRef(false);
  const [pendingError, setPendingError] = useState("");
  const runPending = async (only?: string) => {
    if (busy.current) return;
    busy.current = true;
    setPendingError("");
    try {
      for (const p of listWaiting(only)) {
        try { await processPendingVoice(p.id); }
        catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "network") break;
          setPendingError(voiceFailureText(code));
          break;
        }
      }
    } finally { busy.current = false; }
  };
  const runPendingRef = useRef(runPending);
  useEffect(() => { runPendingRef.current = runPending; });
  useEffect(() => {
    const go = () => void runPendingRef.current();
    if (navigator.onLine !== false) go();
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, []);
  const listWaiting = (only?: string): PendingVoice[] => pending.filter((p) => p.status === "waiting" && (!only || p.id === only));
  useEffect(() => { finishRef.current = finish; });

  const draft = phase.name === "review" ? phase.draft : null;
  const quote = useMemo(() => (db && draft ? quoteFromVoice(db, { ...draft, closedPriceReais: price }, { simple, description }) : null), [db, draft, price, simple, description]);

  if (!db) return <Loading />;
  const canSave = !!quote && quote.totalCents > 0 && !!fields.clientName.trim();
  const save = () => {
    if (!quote) return;
    const id = saveVoiceQuote(db, { ...fields, quote, clientId: visitClient?.id, visitId: visit?.id });
    if (phase.name === "review" && phase.pendingId) void discardVoice(phase.pendingId);
    router.replace(`/orcamentos/${id}`);
  };

  return (
    <Screen title="Orçamento por voz" back={visit ? `/visitas/${visit.id}` : "/orcamentos"}>
      <div className="flex flex-col gap-4 pb-8">
        {!cloudEnabled ? <Card>O orçamento por voz precisa de uma conta com internet. Entre na sua conta para usar.</Card> : null}

        {phase.name === "idle" || phase.name === "error" ? (
          <>
            <Card className="flex flex-col gap-2">
              <b className="text-lg">Fale o orçamento do seu jeito</b>
              <p>Diga o nome do cliente, os cômodos com as medidas, o que vai ser feito e o preço. Exemplo:</p>
              <p className="rounded-xl bg-[#F3F6FA] p-3 italic">“Cliente dona Maria, telefone 11 98888-7777. Sala de 4 por 5, pé direito 2,70, pintar teto e paredes. Quarto 3 por 3,5. Fechado em 2.800 reais, metade de entrada.”</p>
              <p className="text-base text-support">Você confere tudo antes de salvar. O áudio não fica guardado: ele só vira texto e é descartado.</p>
            </Card>
            {phase.name === "error" ? <p role="alert" className="text-base text-err">{phase.text}</p> : null}
            {state === "recording" ? (
              <Button icon={Square} onClick={() => void finish()}>Terminei · {fmtClock(seconds)}</Button>
            ) : (
              <Button icon={Mic} disabled={!cloudEnabled || state === "unsupported"} onClick={() => void begin()}>{phase.name === "error" ? "Gravar de novo" : "Começar a falar"}</Button>
            )}
            {state === "denied" ? <p className="text-base text-err">Sem acesso ao microfone. Permita o microfone nas configurações do navegador e tente de novo.</p> : null}
            {state === "unsupported" ? <p className="text-base text-err">Este navegador não consegue gravar áudio.</p> : null}
          </>
        ) : null}

        {phase.name === "queued" ? (
          <Card className="flex flex-col gap-2">
            <b>Sem internet: áudio guardado no aparelho</b>
            <p>Quando a internet voltar, o app transcreve sozinho e o orçamento fica esperando aqui para você conferir. Mantenha esta tela aberta ou volte depois.</p>
            <Button variant="ghost" icon={Check} onClick={() => setPhase({ name: "idle" })}>Entendi</Button>
          </Card>
        ) : null}

        {phase.name === "sending" ? <Card><b>Entendendo o que você falou…</b><p className="text-support">Costuma levar alguns segundos.</p></Card> : null}

        {pending.length > 0 && (phase.name === "idle" || phase.name === "error" || phase.name === "queued") ? (
          <Card className="flex flex-col gap-2">
            <b>Áudios aguardando ({pending.length})</b>
            {pendingError ? <p role="alert" className="text-base text-err">{pendingError}</p> : null}
            {pending.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl bg-[#F3F6FA] p-3">
                <div className="text-base">{new Date(p.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {fmtClock(p.seconds)} · {p.status === "ready" ? "pronto para conferir" : "esperando internet"}</div>
                <div className="grid grid-cols-2 gap-2">
                  {p.status === "ready" && p.draft ? <Button onClick={() => openReview(p.draft!, p.transcript ?? "", p.id, p.visitId)}>Conferir</Button> : <Button variant="ghost" onClick={() => void runPending(p.id)}>Tentar agora</Button>}
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void discardVoice(p.id)}>Apagar</Button>
                </div>
              </div>
            ))}
          </Card>
        ) : null}

        {phase.name === "review" && quote ? (
          <>
            <Card className="flex flex-col gap-3">
              <b className="text-lg">Confira o que eu entendi</b>
              {visitClient ? (
                <div><div className="text-lg font-semibold">{visitClient.name}</div>{visitClient.phone ? <div className="text-support">{visitClient.phone}</div> : null}<div className="text-base text-support">Cliente da visita. O orçamento fica ligado a ela.</div></div>
              ) : (
                <>
                  <Field label="Cliente"><TextInput value={fields.clientName} onChange={(e) => setFields({ ...fields, clientName: e.target.value })} /></Field>
                  <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} /></Field>
                </>
              )}
              <Field label="Endereço da obra"><TextInput value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} /></Field>
            </Card>

            {simple ? null : <Card className="flex flex-col gap-2">
              <b>Ambientes</b>
              {quote.rooms.length === 0 ? <p className="text-support">Nenhuma medida entendida. Tudo bem se você deu o preço fechado: ele vira um item só. Ou grave de novo falando as medidas.</p> : null}
              {quote.rooms.map((r) => (
                <div key={r.id} className="rounded-xl bg-[#F3F6FA] p-3">
                  <b>{r.name}</b>
                  <div className="text-base text-support">{r.surfaces?.length ? surfacesSummary(r.surfaces, r.openings.filter((o) => o.kind === "door").reduce((n, o) => n + o.qty, 0), r.openings.filter((o) => o.kind === "window").reduce((n, o) => n + o.qty, 0)) : ""}</div>
                </div>
              ))}
              {quote.skippedRooms.length > 0 ? <p className="text-base text-[#8A4B00]">Sem medida, ficaram de fora: {quote.skippedRooms.join(", ")}. Você pode completar editando o orçamento depois.</p> : null}
            </Card>}

            <Card className="flex flex-col gap-3">
              {quote.priceOnly ? <Field label="O que será feito" hint="Aparece no orçamento do cliente."><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></Field> : null}
              <Field label="Preço fechado (R$)" hint={price > 0 ? "O total do orçamento fica exatamente neste valor." : simple ? "Digite o preço que você fechou." : "Deixe 0 para o app calcular pelos seus preços dos Ajustes."}>
                <NumberInput value={price} onChange={(n) => setPrice(Math.max(0, n))} />
              </Field>
              <Field label="Forma de pagamento"><TextInput value={fields.paymentTerms} placeholder={db.company?.paymentTerms ?? ""} onChange={(e) => setFields({ ...fields, paymentTerms: e.target.value })} /></Field>
              <Field label="Observações (aparecem no PDF)"><TextInput value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} /></Field>
            </Card>

            <details className="rounded-2xl border border-line p-3">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">O que eu ouvi</summary>
              <p className="mt-2 whitespace-pre-wrap text-support">{phase.transcript}</p>
            </details>

            <div className="rounded-2xl border border-brand/25 bg-brand-soft p-4">
              <div className="text-base text-support">Preço para o cliente</div>
              <div className="font-display text-[32px] font-semibold leading-9 text-brand" data-testid="total">{quote.totalCents > 0 ? formatBRL(quote.totalCents) : "—"}</div>
              {!simple && quote.totalCents > 0 && !quote.priceOnly ? (
                <p className={`mt-1 text-base font-semibold ${quote.profitCents < 0 ? "text-err" : "text-support"}`}>
                  {quote.profitCents < 0
                    ? `Atenção: com os seus preços, este valor dá prejuízo de ${formatBRL(-quote.profitCents)}. Custo estimado: ${formatBRL(quote.costCents)}.`
                    : `Só para você: custo estimado ${formatBRL(quote.costCents)}, lucro estimado ${formatBRL(quote.profitCents)}.`}
                </p>
              ) : null}
              {!simple && quote.totalCents > 0 && quote.priceOnly ? <p className="mt-1 text-base text-support">Só o preço, sem medidas: o app não calcula custo, lucro nem prazo.</p> : null}
              {!fields.clientName.trim() ? <p className="text-base text-support">Falta o nome do cliente.</p> : quote.totalCents === 0 ? <p className="text-base text-support">{simple ? "Falta o preço." : "Falta o preço ou as medidas."}</p> : null}
            </div>
            <Button icon={Check} disabled={!canSave} onClick={save}>Salvar orçamento</Button>
            <Button variant="ghost" size="sm" icon={Mic} onClick={() => setPhase({ name: "idle" })}>Gravar de novo</Button>
          </>
        ) : null}
      </div>
    </Screen>
  );
}
