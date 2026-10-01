"use client";
import { use, useRef, useState } from "react";
import { Button, Card, Field, LinkButton, Loading, Screen, TextArea, TextInput } from "@/components/ui";
import { PhotoGrid } from "@/components/PhotoGrid";
import { addVisitPhotos, removeVisitPhoto, setVisitAddress, setVisitNotes } from "@/modules/visits";
import { useAppDb } from "@/modules/useApp";
import { fmtDate } from "@/shared/format";

export default function Visita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!db) return <Loading />;
  const v = db.visits.find((x) => x.id === id);
  if (!v) return <Screen title="Visita" back="/visitas"><p>Visita não encontrada.</p></Screen>;
  const client = db.clients.find((c) => c.id === v.clientId);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { await addVisitPhotos(v.id, Array.from(files)); } finally { setBusy(false); }
    if (input.current) input.current.value = "";
  };

  return (
    <Screen title={client?.name ?? "Visita"} back="/visitas">
      <div className="text-sm text-slate-600">Visita de {fmtDate(v.createdAt)} · salva automaticamente</div>
      <Field label="Endereço da obra"><TextInput value={v.siteAddress} onChange={(e) => setVisitAddress(v.id, e.target.value)} /></Field>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Fotos ({v.photoIds.length})</h2>
        <PhotoGrid ids={v.photoIds} onRemove={(pid) => removeVisitPhoto(v.id, pid)} />
        <input ref={input} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => onFiles(e.target.files)} data-testid="photo-input" />
        <Button variant="ghost" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Guardando…" : "📷 Tirar / escolher fotos"}</Button>
        <p className="text-sm text-slate-500">As fotos ficam guardadas neste aparelho.</p>
      </Card>

      <Field label="Observações" hint="O que o cliente pediu, medidas que lembrar, problemas que viu…">
        <TextArea value={v.notes} onChange={(e) => setVisitNotes(v.id, e.target.value)} placeholder="Ex.: Sala 4x5, parede com mofo perto da janela, cliente quer cor branca gelo…" />
      </Field>

      <LinkButton href={`/orcamentos/novo?visita=${v.id}`}>{v.quoteId ? "Montar outro orçamento" : "Montar orçamento"}</LinkButton>
      {v.quoteId ? <LinkButton href={`/orcamentos/${v.quoteId}`} variant="ghost">Ver orçamento feito</LinkButton> : null}
    </Screen>
  );
}
