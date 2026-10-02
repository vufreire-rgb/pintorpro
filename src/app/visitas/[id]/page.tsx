"use client";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { CameraCapture } from "@/components/CameraCapture";
import { ContactActions } from "@/components/ContactActions";
import { PhotoGrid } from "@/components/PhotoGrid";
import { RoomFormCard } from "@/components/RoomFormCard";
import { Button, Card, Chip, ConfirmDialog, Field, LinkButton, Loading, Screen, TextArea, TextInput } from "@/components/ui";
import { cloudEnabled } from "@/modules/auth";
import { MAX_PDF_PHOTOS } from "@/modules/pdfData";
import { EMPTY_ROOM, type RoomForm } from "@/modules/rooms";
import { downloadVisitIcs } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { addVisitPhotos, addVisitRoom, createClientForVisit, deleteVisit, removeVisitPhoto, removeVisitRoom, rescheduleVisit, setPhotoMeta, setVisitAddress, setVisitClient, setVisitNotes, startVisit } from "@/modules/visits";
import { confirmationText, fromLocalInput, toLocalInput, visitState, waUrl, whenLabel } from "@/modules/visitList";
import { fmtDate, fmtNum } from "@/shared/format";

export default function Visita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [camera, setCamera] = useState(false);
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "" });
  const [form, setForm] = useState<RoomForm>(EMPTY_ROOM);
  const [when, setWhen] = useState("");
  if (!db) return <Loading />;
  const v = db.visits.find((x) => x.id === id);
  if (!v) return <Screen title="Visita" back="/visitas"><p>Visita não encontrada.</p></Screen>;
  const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
  const state = visitState(v);
  const rooms = v.rooms ?? [];

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { await addVisitPhotos(v.id, Array.from(files)); } finally { setBusy(false); }
    if (input.current) input.current.value = "";
  };

  return (
    <Screen title={client?.name ?? "Visita"} back="/visitas">
      {state !== "done" && v.scheduledAt ? (
        <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
          <div className="font-bold">{state === "late" ? "⏰ Visita atrasada" : "📅 Visita agendada"}</div>
          <div className="text-2xl font-bold text-brand">{whenLabel(v.scheduledAt)}</div>
          <Button onClick={() => startVisit(v.id)}>▶ Começar a visita agora</Button>
          {client?.phone ? <a className="grid min-h-14 place-items-center rounded-2xl bg-white px-5 text-lg font-semibold" href={waUrl(client.phone, confirmationText(v, client, db.company))} target="_blank" rel="noreferrer">💬 Confirmar pelo WhatsApp</a> : null}
          <Button variant="ghost" onClick={() => downloadVisitIcs(v, client)}>🗓 Adicionar à agenda do celular</Button>
          <Field label="Mudar dia e hora"><TextInput type="datetime-local" value={when || toLocalInput(v.scheduledAt)} onChange={(e) => setWhen(e.target.value)} /></Field>
          {when ? <Button variant="ghost" onClick={() => { rescheduleVisit(v.id, fromLocalInput(when)); setWhen(""); }}>Salvar novo horário</Button> : null}
        </Card>
      ) : (
        <div className="text-sm text-slate-600">Visita de {fmtDate(v.startedAt ?? v.createdAt)} · guardada automaticamente · toque em <b>Salvar visita</b> ao terminar</div>
      )}

      <Card className="flex flex-col gap-3">
        {client && !changing ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold">{client.name}</div>
                {client.phone ? <div className="text-slate-600">{client.phone}</div> : null}
              </div>
              <button className="min-h-10 px-2 text-brand underline" onClick={() => setChanging(true)}>Trocar</button>
            </div>
            <ContactActions phone={client.phone} address={v.siteAddress || client.address} />
          </>
        ) : (
          client ? (
            <>
              <b>Trocar cliente</b>
              <div className="flex flex-wrap gap-2">
                {db.clients.map((c) => <Chip key={c.id} active={v.clientId === c.id} onClick={() => { setVisitClient(v.id, c.id); setChanging(false); }}>{c.name}</Chip>)}
              </div>
              <Button variant="ghost" onClick={() => setChanging(false)}>Cancelar</Button>
            </>
          ) : <p className="text-slate-600">👤 O nome e o telefone do cliente você coloca na hora de salvar a visita.</p>
        )}
        <Field label="Endereço da obra"><TextInput value={v.siteAddress} onChange={(e) => setVisitAddress(v.id, e.target.value)} /></Field>
      </Card>

      <Card><AudioRecorder visitId={v.id} audios={v.audios ?? []} consent={!!v.recordingConsent} /></Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Fotos ({v.photoIds.length})</h2>
        <PhotoGrid
          ids={v.photoIds}
          onRemove={(pid) => removeVisitPhoto(v.id, pid)}
          selectedIds={v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf)}
          onToggle={(pid) => setPhotoMeta(v.id, pid, { inPdf: !v.photoMeta?.[pid]?.inPdf }, MAX_PDF_PHOTOS) || setMsg(`Máximo de ${MAX_PDF_PHOTOS} fotos no PDF.`)}
        />
        {v.photoIds.some((pid) => v.photoMeta?.[pid]?.inPdf) ? (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
            <b className="text-sm">Fotos no PDF do cliente</b>
            {v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf).map((pid, i) => (
              <div key={pid} className="grid grid-cols-2 gap-2">
                <TextInput placeholder={`Foto ${i + 1}: ambiente`} value={v.photoMeta?.[pid]?.room ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { room: e.target.value }, MAX_PDF_PHOTOS)} />
                <TextInput placeholder="Legenda" value={v.photoMeta?.[pid]?.caption ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { caption: e.target.value }, MAX_PDF_PHOTOS)} />
              </div>
            ))}
          </div>
        ) : v.photoIds.length > 0 ? <p className="text-sm text-slate-500">Toque em <b>+ PDF</b> nas fotos que quer mostrar no orçamento (até {MAX_PDF_PHOTOS}).</p> : null}
        {msg ? <p className="text-sm text-red-700">{msg}</p> : null}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid="photo-input" />
        <Button onClick={() => setCamera(true)}>📷 Tirar fotos (várias)</Button>
        <Button variant="ghost" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Guardando…" : "🖼 Escolher da galeria"}</Button>
        <p className="text-sm text-slate-500">{cloudEnabled ? "Suas fotos ficam guardadas na sua conta." : "As fotos ficam guardadas neste aparelho."}</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Medidas ({rooms.length})</h2>
        {rooms.length === 0 ? <p className="text-sm text-slate-500">Anote aqui os ambientes e as medidas. Eles já viram o orçamento, sem digitar de novo.</p> : null}
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <div>
              <b>{r.name}</b>
              <div className="text-sm text-slate-600">{fmtNum(r.lengthM)} × {fmtNum(r.widthM)} m · altura {fmtNum(r.heightM)} m · {r.doors} porta(s) · {r.windows} janela(s)</div>
            </div>
            <button className="h-10 w-10 shrink-0 rounded-full bg-slate-200" aria-label={`Remover ${r.name}`} onClick={() => removeVisitRoom(v.id, r.id)}>✕</button>
          </div>
        ))}
        <RoomFormCard
          title={rooms.length ? "Adicionar outro ambiente" : "Anotar o primeiro ambiente"}
          form={form}
          onChange={setForm}
          onAdd={() => { addVisitRoom(v.id, form); setForm({ ...EMPTY_ROOM, condition: form.condition, heightM: form.heightM }); }}
        />
      </Card>

      <Field label="Observações" hint="O que o cliente pediu, problemas que viu…">
        <TextArea value={v.notes} onChange={(e) => setVisitNotes(v.id, e.target.value)} placeholder="Ex.: Cliente quer cor branco gelo, parede com mofo perto da janela…" />
      </Field>

      <Button onClick={() => (client ? router.push("/visitas") : setSaving(true))}>✅ Salvar visita</Button>
      <LinkButton href={`/orcamentos/novo?visita=${v.id}`} variant="ghost">{v.quoteId ? "Montar outro orçamento" : "Montar orçamento"}</LinkButton>
      {v.quoteId ? <LinkButton href={`/orcamentos/${v.quoteId}`} variant="ghost">Ver orçamento feito</LinkButton> : null}
      <Button variant="ghost" className="text-red-700" onClick={() => setAskDelete(true)}>🗑 Apagar visita</Button>
      <ConfirmDialog
        open={askDelete}
        title="Apagar esta visita?"
        text="As fotos, os áudios, as medidas e as observações serão apagados. O orçamento já feito a partir dela continua existindo. Isso não pode ser desfeito."
        onCancel={() => setAskDelete(false)}
        onConfirm={async () => { await deleteVisit(v.id, db.visits); router.replace("/visitas"); }}
      />
      {saving ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
          <div className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-3xl bg-white p-5">
            <h2 className="text-xl font-bold">Quem é o cliente?</h2>
            {db.clients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => { setVisitClient(v.id, c.id); router.push("/visitas"); }}>{c.name}</Chip>)}
              </div>
            ) : null}
            <Field label={db.clients.length > 0 ? "Ou cadastre um novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
            <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            <Button disabled={!newClient.name.trim()} onClick={() => { createClientForVisit(v.id, { ...newClient, address: v.siteAddress }); router.push("/visitas"); }}>✅ Salvar visita</Button>
            <Button variant="ghost" onClick={() => setSaving(false)}>Voltar</Button>
          </div>
        </div>
      ) : null}
      {camera ? (
        <CameraCapture
          rooms={rooms.map((r) => r.name)}
          onShot={async (file, room) => { await addVisitPhotos(v.id, [file], room || undefined); }}
          onClose={() => setCamera(false)}
        />
      ) : null}
    </Screen>
  );
}
