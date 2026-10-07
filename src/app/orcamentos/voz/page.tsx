"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button, Card, Field, Loading, NumberInput, Screen, TextInput } from "@/components/ui";
import { cloudEnabled } from "@/modules/auth";
import { fmtClock, useRecorder } from "@/modules/audio";
import { quoteFromVoice, requestVoiceDraft, saveVoiceQuote, voiceFailureText, type VoiceDraft } from "@/modules/voice";
import { surfacesSummary } from "@/modules/rooms";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

/** Passa disso o áudio fica grande e caro: para sozinho. */
const MAX_SECONDS = 180;

type Phase = { name: "idle" } | { name: "sending" } | { name: "review"; draft: VoiceDraft; transcript: string } | { name: "error"; text: string };

export default function OrcamentoPorVozPage() {
  const db = useAppDb();
  const router = useRouter();
  const { state, seconds, start, stop } = useRecorder();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [fields, setFields] = useState({ clientName: "", phone: "", address: "", paymentTerms: "", notes: "" });
  const [price, setPrice] = useState(0);

  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef<() => Promise<void>>(async () => undefined);
  const begin = async () => {
    await start();
    autoStop.current = setTimeout(() => void finishRef.current(), MAX_SECONDS * 1000);
  };
  useEffect(() => () => { if (autoStop.current) clearTimeout(autoStop.current); }, []);

  const finish = async () => {
    if (autoStop.current) clearTimeout(autoStop.current);
    const out = await stop();
    if (!out) return;
    setPhase({ name: "sending" });
    try {
      const { transcript, draft } = await requestVoiceDraft(out.blob);
      setFields({ clientName: draft.clientName, phone: draft.phone, address: draft.address, paymentTerms: draft.paymentTerms, notes: draft.notes });
      setPrice(draft.closedPriceReais);
      setPhase({ name: "review", draft, transcript });
    } catch (e) {
      setPhase({ name: "error", text: voiceFailureText(e instanceof Error ? e.message : "") });
    }
  };
  useEffect(() => { finishRef.current = finish; });

  const draft = phase.name === "review" ? phase.draft : null;
  const quote = useMemo(() => (db && draft ? quoteFromVoice(db, { ...draft, closedPriceReais: price }) : null), [db, draft, price]);

  if (!db) return <Loading />;
  const canSave = !!quote && quote.totalCents > 0 && !!fields.clientName.trim();
  const save = () => {
    if (!quote) return;
    const id = saveVoiceQuote(db, { ...fields, quote });
    router.replace(`/orcamentos/${id}`);
  };

  return (
    <Screen title="Orçamento por voz" back="/orcamentos">
      <div className="flex flex-col gap-4 pb-8">
        {!cloudEnabled ? <Card>O orçamento por voz precisa de uma conta com internet. Entre na sua conta para usar.</Card> : null}

        {phase.name === "idle" || phase.name === "error" ? (
          <>
            <Card className="flex flex-col gap-2">
              <b className="text-lg">Fale o orçamento do seu jeito</b>
              <p>Diga o nome do cliente, os cômodos com as medidas, o que vai ser feito e o preço. Exemplo:</p>
              <p className="rounded-xl bg-slate-50 p-3 italic">“Cliente dona Maria, telefone 11 98888-7777. Sala de 4 por 5, pé direito 2,70, pintar teto e paredes. Quarto 3 por 3,5. Fechado em 2.800 reais, metade de entrada.”</p>
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

        {phase.name === "sending" ? <Card><b>Entendendo o que você falou…</b><p className="text-support">Costuma levar alguns segundos.</p></Card> : null}

        {phase.name === "review" && quote ? (
          <>
            <Card className="flex flex-col gap-3">
              <b className="text-lg">Confira o que eu entendi</b>
              <Field label="Cliente"><TextInput value={fields.clientName} onChange={(e) => setFields({ ...fields, clientName: e.target.value })} /></Field>
              <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} /></Field>
              <Field label="Endereço da obra"><TextInput value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} /></Field>
            </Card>

            <Card className="flex flex-col gap-2">
              <b>Ambientes</b>
              {quote.rooms.length === 0 ? <p className="text-support">Nenhuma medida entendida. Tudo bem se você deu o preço fechado: ele vira um item só. Ou grave de novo falando as medidas.</p> : null}
              {quote.rooms.map((r) => (
                <div key={r.id} className="rounded-xl bg-slate-50 p-3">
                  <b>{r.name}</b>
                  <div className="text-base text-support">{r.surfaces?.length ? surfacesSummary(r.surfaces, r.openings.filter((o) => o.kind === "door").reduce((n, o) => n + o.qty, 0), r.openings.filter((o) => o.kind === "window").reduce((n, o) => n + o.qty, 0)) : ""}</div>
                </div>
              ))}
              {quote.skippedRooms.length > 0 ? <p className="text-base text-[#8A4B00]">Sem medida, ficaram de fora: {quote.skippedRooms.join(", ")}. Você pode completar editando o orçamento depois.</p> : null}
            </Card>

            <Card className="flex flex-col gap-3">
              <Field label="Preço fechado (R$)" hint={price > 0 ? "O total do orçamento fica exatamente neste valor." : "Deixe 0 para o app calcular pelos seus preços dos Ajustes."}>
                <NumberInput value={price} onChange={(n) => setPrice(Math.max(0, n))} />
              </Field>
              <Field label="Forma de pagamento"><TextInput value={fields.paymentTerms} placeholder={db.company?.paymentTerms ?? ""} onChange={(e) => setFields({ ...fields, paymentTerms: e.target.value })} /></Field>
              <Field label="Observações (aparecem no PDF)"><TextInput value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} /></Field>
            </Card>

            <details className="rounded-2xl border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold">O que eu ouvi</summary>
              <p className="mt-2 whitespace-pre-wrap text-support">{phase.transcript}</p>
            </details>

            <div className="rounded-2xl border border-brand/25 bg-brand-soft p-4">
              <div className="text-base text-support">Preço para o cliente</div>
              <div className="font-display text-[32px] font-extrabold leading-9 text-brand" data-testid="total">{quote.totalCents > 0 ? formatBRL(quote.totalCents) : "—"}</div>
              {!fields.clientName.trim() ? <p className="text-base text-support">Falta o nome do cliente.</p> : quote.totalCents === 0 ? <p className="text-base text-support">Falta o preço ou as medidas.</p> : null}
            </div>
            <Button disabled={!canSave} onClick={save}>Salvar orçamento</Button>
            <Button variant="ghost" onClick={() => setPhase({ name: "idle" })}>Gravar de novo</Button>
          </>
        ) : null}
      </div>
    </Screen>
  );
}
