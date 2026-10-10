"use client";
import { DictateButton } from "@/components/DictateButton";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { CameraCapture } from "@/components/CameraCapture";
import { ContactActions } from "@/components/ContactActions";
import { PhotoMarker } from "@/components/PhotoMarker";
import { PhotoGrid, PhotoStrip } from "@/components/PhotoGrid";
import { RoomEditor } from "@/components/RoomEditor";
import { BlocoRecolhivel, bareTextCls, Button, buttonCls, CartaoDeObservacao, Card, CardTitle, Chip, ConfirmDialog, Field, LinhaDeDado, LinkButton, Loading, Screen, TextArea2, TextInput } from "@/components/ui";
import { AlarmClock, ArrowLeft, CalendarDays, CalendarPlus, Camera, Check, Copy, FilePlus2, FileText, Image as ImageIcon, MapPin, MessageCircle, Mic, Play, Ruler, Trash2, UserPlus, X } from "lucide-react";
import { cloudEnabled } from "@/modules/auth";
import { GEO_MESSAGE, GeoError, getPosition, reverseGeocode } from "@/modules/geo";
import { MAX_PDF_PHOTOS } from "@/modules/pdfData";
import { photosFailedMessage } from "@/modules/photos";
import { blankRoom, cloneSurfaces, legacyToSurfaces, measuresSummary, surfacesSummary, type RoomDraft } from "@/modules/rooms";
import { downloadVisitIcs } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { isSimpleMode } from "@/modules/settings";
import { addVisitPhotos, createClientForVisit, deleteVisit, removeVisitPhoto, removeVisitRoom, rescheduleVisit, setPhotoMarks, setPhotoMeta, setVisitAddress, setVisitLocation, setVisitClient, saveVisitRoom, setVisitNotes, startVisit, appendVisitNotes, appendPhotoCaption } from "@/modules/visits";
import { confirmationText, fromLocalInput, mapsUrl, toLocalInput, visitState, waUrl, whenLabel } from "@/modules/visitList";
import { fmtDate, fmtNum, plural } from "@/shared/format";

export default function Visita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAppDb();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [camera, setCamera] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [fromOsm, setFromOsm] = useState(false);
  /** Ambiente aberto para anotar: "novo" ou o id de um já anotado. */
  const [editing, setEditing] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  /** O diálogo "Quem é o cliente?" foi aberto só para definir o cliente (sem terminar a visita). */
  const [clientOnly, setClientOnly] = useState(false);
  /** Depois de salvar: pergunta se quer montar o orçamento agora (o passo mais importante do app). */
  const [savedAsk, setSavedAsk] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "" });
  const [draft, setDraft] = useState<RoomDraft>({ name: "", surfaces: [], doors: 1, windows: 1 });
  const [when, setWhen] = useState("");
  /** Muda quando uma foto é adicionada: abre o bloco Fotos. */
  const [photoSignal, setPhotoSignal] = useState(0);
  if (!db) return <Loading />;
  const v = db.visits.find((x) => x.id === id);
  if (!v) return <Screen title="Visita" back="/visitas"><p>Visita não encontrada.</p></Screen>;
  const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
  const state = visitState(v);
  const rooms = v.rooms ?? [];
  const simple = isSimpleMode(db.company);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { failed } = await addVisitPhotos(v.id, Array.from(files));
      setMsg(failed ? photosFailedMessage(failed) : "");
      setPhotoSignal((n) => n + 1);
    } finally { setBusy(false); }
    if (input.current) input.current.value = "";
  };

  /** Visita já tem orçamento? Volta à lista. Senão, oferece montar o orçamento agora. */
  const finish = () => { if (v.quoteId) router.push("/visitas"); else { setSaving(false); setSavedAsk(true); } };

  const fillFromLocation = async () => {
    setLocating(true);
    setGeoMsg("");
    setFromOsm(false);
    try {
      const point = await getPosition();
      const found = await reverseGeocode(point);
      setVisitLocation(v.id, point, found?.text);
      setFromOsm(!!found);
      setGeoMsg(!found ? "Salvei o ponto no mapa, mas não consegui descobrir o nome da rua. Digite o endereço acima." : found.hasNumber ? "Endereço preenchido. Confira se está certo." : "Preenchi a rua. Falta o número: complete acima.");
    } catch (e) {
      setGeoMsg(e instanceof GeoError ? GEO_MESSAGE[e.reason] : GEO_MESSAGE.unavailable);
    } finally {
      setLocating(false);
    }
  };

  return (
    <Screen title={client?.name ?? "Visita"} back="/visitas">
      {state !== "done" && v.scheduledAt ? (
        <Card className="flex flex-col gap-3 border-brand/30 bg-brand-soft">
          <CardTitle icon={state === "late" ? AlarmClock : CalendarDays}>{state === "late" ? "Visita atrasada" : "Visita agendada"}</CardTitle>
          <div className="font-display text-[28px] font-semibold leading-[34px] text-brand">{whenLabel(v.scheduledAt)}</div>
          <Button variant="ghost" className="!bg-white" icon={Play} onClick={() => startVisit(v.id)}>Começar a visita agora</Button>
          {client?.phone ? <a className={buttonCls("ghost", "!bg-white")} href={waUrl(client.phone, confirmationText(v, client, db.company))} target="_blank" rel="noreferrer"><MessageCircle size={24} strokeWidth={2.2} aria-hidden />Confirmar pelo WhatsApp</a> : null}
          <Button variant="ghost" className="!bg-white" icon={CalendarPlus} onClick={() => downloadVisitIcs(v, client)}>Adicionar à agenda do celular</Button>
          <Field label="Mudar dia e hora"><TextInput type="datetime-local" value={when || toLocalInput(v.scheduledAt)} onChange={(e) => setWhen(e.target.value)} /></Field>
          {when ? <Button variant="ghost" className="!bg-white" icon={Check} onClick={() => { rescheduleVisit(v.id, fromLocalInput(when)); setWhen(""); }}>Salvar novo horário</Button> : null}
        </Card>
      ) : (
        <div className="text-base leading-[22px] text-support">{fmtDate(v.startedAt ?? v.createdAt)} · guardada automaticamente</div>
      )}

      {!client ? (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-base text-support">Cliente</div><div className="text-lg font-bold">A definir</div></div>
          <Button variant="ghost" size="sm" icon={UserPlus} className="!w-auto shrink-0" onClick={() => { setClientOnly(true); setSaving(true); }}>Definir cliente</Button>
        </Card>
      ) : null}

      {client ? (
        <Card className="flex flex-col gap-3">
          {!changing ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{client.name}</div>
                  {client.phone ? <div className="text-support">{client.phone}</div> : null}
                </div>
                <button className="min-h-12 px-2 font-display text-lg font-semibold text-live" onClick={() => setChanging(true)}>Trocar</button>
              </div>
              <ContactActions phone={client.phone} address={v.siteAddress || client.address} location={v.location} />
            </>
          ) : (
            <>
              <b>Trocar cliente</b>
              <div className="flex flex-wrap gap-2">
                {db.clients.map((c) => <Chip key={c.id} active={v.clientId === c.id} onClick={() => { setVisitClient(v.id, c.id); setChanging(false); }}>{c.name}</Chip>)}
              </div>
              <Button variant="ghost" size="sm" icon={X} onClick={() => setChanging(false)}>Cancelar</Button>
            </>
          )}
        </Card>
      ) : null}

      <LinhaDeDado
        icon={MapPin}
        label="Endereço da obra"
        value={v.siteAddress}
        openWhen={locating || !!geoMsg}
        editor={<TextArea2 aria-label="Endereço da obra" value={v.siteAddress} onChange={(e) => setVisitAddress(v.id, e.target.value)} />}
        actions={(
          <>
            <Button variant="ghost" size="sm" icon={MapPin} disabled={locating} onClick={fillFromLocation}>{locating ? "Buscando sua posição…" : v.location ? "Atualizar pela minha localização" : "Usar minha localização"}</Button>
            {v.location ? <p className="text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden className="mr-1 inline" />Ponto no mapa salvo{v.location.accuracy ? ` (precisão de cerca de ${v.location.accuracy} m)` : ""}. <a className="underline" href={mapsUrl(v.siteAddress, v.location)} target="_blank" rel="noreferrer">Abrir no mapa</a></p> : null}
            {geoMsg ? <p className="text-base text-ink">{geoMsg}</p> : null}
            {fromOsm ? <p className="text-base text-support">Endereço sugerido com dados © colaboradores do <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p> : null}
          </>
        )}
      />

      <AudioRecorder visitId={v.id} audios={v.audios ?? []} consent={!!v.recordingConsent} onTranscript={(t) => appendVisitNotes(v.id, t)} />

      <BlocoRecolhivel
        title="Fotos"
        icon={Camera}
        summary={v.photoIds.length === 0 ? "Nenhuma foto" : plural(v.photoIds.length, "foto", "fotos")}
        preview={<PhotoStrip ids={v.photoIds} />}
        openWhen={!!msg}
        openSignal={photoSignal}
        action={{ label: "Foto", ariaLabel: "Tirar fotos (várias)", icon: Camera, opens: true, onClick: () => setCamera(true) }}
      >
        <PhotoGrid
          ids={v.photoIds}
          marksOf={(pid) => v.photoMeta?.[pid]?.marks}
          onMark={setMarking}
          onRemove={(pid) => removeVisitPhoto(v.id, pid)}
          selectedIds={v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf)}
          onToggle={(pid) => setPhotoMeta(v.id, pid, { inPdf: !v.photoMeta?.[pid]?.inPdf }, MAX_PDF_PHOTOS) || setMsg(`Máximo de ${MAX_PDF_PHOTOS} fotos no PDF.`)}
        />
        {v.photoIds.some((pid) => v.photoMeta?.[pid]?.inPdf) ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-[#F3F6FA] p-3">
            <b className="text-base">Fotos no PDF do cliente</b>
            {v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf).map((pid, i) => (
              <div key={pid} className="flex flex-col gap-2">
                <TextInput placeholder={`Foto ${i + 1}: ambiente`} value={v.photoMeta?.[pid]?.room ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { room: e.target.value }, MAX_PDF_PHOTOS)} />
                <TextArea2 placeholder="Legenda" aria-label={`Legenda da foto ${i + 1}`} value={v.photoMeta?.[pid]?.caption ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { caption: e.target.value }, MAX_PDF_PHOTOS)} />
                <div className="self-end"><DictateButton maxSeconds={30} label="Ditar legenda" what={`legenda da foto ${i + 1}`} onText={(t) => appendPhotoCaption(v.id, pid, t)} /></div>
              </div>
            ))}
          </div>
        ) : v.photoIds.length > 0 ? <p className="text-base text-support">Toque em <b>+ PDF</b> nas fotos que quer mostrar no orçamento (até {MAX_PDF_PHOTOS}) e no <b>lápis</b> para desenhar setas, textos e medidas.</p> : null}
        {msg ? <p className="text-base text-err">{msg}</p> : null}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid="photo-input" />
        <Button variant="ghost" icon={ImageIcon} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Guardando…" : "Escolher da galeria"}</Button>
        <p className="text-base text-support">{cloudEnabled ? "Suas fotos ficam guardadas na sua conta." : "As fotos ficam guardadas neste aparelho."}</p>
      </BlocoRecolhivel>

      {simple ? null : (
      <BlocoRecolhivel
        title="Medidas"
        icon={Ruler}
        summary={measuresSummary(rooms)}
        openWhen={editing !== null}
        action={editing ? undefined : { label: "Medir", ariaLabel: rooms.length ? "Anotar outro ambiente" : "Anotar as medidas de um ambiente", icon: Ruler, opens: true, onClick: () => { const b = blankRoom(rooms.length + 1); setDraft({ name: b.name, surfaces: b.surfaces!, doors: b.doors, windows: b.windows }); setEditing("novo"); } }}
      >
        {rooms.length === 0 ? <p className="text-base text-support">Anote aqui os ambientes e as medidas. Eles já viram o orçamento, sem digitar de novo.</p> : null}
        {rooms.map((r) => editing === r.id ? null : (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-[#F3F6FA] p-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => { setDraft({ name: r.name, surfaces: r.surfaces?.length ? r.surfaces : legacyToSurfaces(r.lengthM, r.widthM, r.heightM), doors: r.doors, windows: r.windows }); setEditing(r.id); }} aria-label={`Editar ${r.name}`}>
              <b>{r.name}</b>
              <div className="text-base text-support">{r.surfaces?.length ? `${plural(r.surfaces.filter((s) => s.kind === "wall").length, "parede", "paredes")} · ${surfacesSummary(r.surfaces, r.doors, r.windows)}` : `${fmtNum(r.lengthM)} × ${fmtNum(r.widthM)} m · altura ${fmtNum(r.heightM)} m`} · {plural(r.doors, "porta", "portas")} · {plural(r.windows, "janela", "janelas")}</div>
            </button>
            <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white" aria-label={`Duplicar ${r.name}`} onClick={() => saveVisitRoom(v.id, { name: `${r.name} (cópia)`, surfaces: cloneSurfaces(r.surfaces?.length ? r.surfaces : legacyToSurfaces(r.lengthM, r.widthM, r.heightM)), doors: r.doors, windows: r.windows })}><Copy size={20} strokeWidth={2.2} aria-hidden /></button>
            <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white" aria-label={`Remover ${r.name}`} onClick={() => removeVisitRoom(v.id, r.id)}><X size={20} strokeWidth={2.4} aria-hidden /></button>
          </div>
        ))}
        {editing ? (
          <RoomEditor
            title={editing === "novo" ? (rooms.length ? "Outro ambiente" : "Primeiro ambiente") : "Editar ambiente"}
            draft={draft}
            onChange={setDraft}
            onSave={() => { saveVisitRoom(v.id, draft, editing === "novo" ? undefined : editing); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </BlocoRecolhivel>
      )}

      <CartaoDeObservacao
        label="Observações"
        hint="O que o cliente pediu, problemas que viu…"
      >
        <textarea className={bareTextCls} value={v.notes} onChange={(e) => setVisitNotes(v.id, e.target.value)} placeholder="Ex.: Cliente quer cor branco gelo, parede com mofo perto da janela…" />
      </CartaoDeObservacao>

      <div className="flex flex-col gap-2">
        <LinkButton href={`/orcamentos/novo?visita=${v.id}`} variant="ghost" icon={FilePlus2} aria-label={v.quoteId ? "Montar outro orçamento" : "Montar orçamento"}>{v.quoteId ? "Montar outro orçamento" : "Montar orçamento"}</LinkButton>
        <LinkButton href={`/orcamentos/voz?visita=${v.id}`} variant="ghost" size="sm" icon={Mic}>Ditar o orçamento por voz</LinkButton>
        {v.quoteId ? <LinkButton href={`/orcamentos/${v.quoteId}`} variant="ghost" size="sm" icon={FileText}>Ver orçamento feito</LinkButton> : null}
      </div>
      <Button variant="danger" icon={Trash2} onClick={() => setAskDelete(true)}>Apagar visita</Button>
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-[#F3F6FA] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5">
        <Button icon={Check} onClick={() => (client ? finish() : setSaving(true))}>Salvar visita</Button>
      </div>
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
                {db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => { setVisitClient(v.id, c.id); setSaving(false); if (!clientOnly) finish(); setClientOnly(false); }}>{c.name}</Chip>)}
              </div>
            ) : null}
            <Field label={db.clients.length > 0 ? "Ou cadastre um novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
            <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            <Button icon={Check} disabled={!newClient.name.trim()} onClick={() => { createClientForVisit(v.id, { ...newClient, address: v.siteAddress }); setSaving(false); if (!clientOnly) finish(); setClientOnly(false); }}>{clientOnly ? "Salvar cliente" : "Salvar visita"}</Button>
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => { setSaving(false); setClientOnly(false); }}>Voltar</Button>
          </div>
        </div>
      ) : null}
      {savedAsk ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Visita salva">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-3xl bg-white p-5">
            <h2 className="font-display text-xl font-semibold">Visita salva!</h2>
            <p className="text-lg text-support">Quer montar o orçamento agora? As medidas e anotações já vão junto.</p>
            <LinkButton href={`/orcamentos/novo?visita=${v.id}`} icon={FilePlus2}>Montar orçamento agora</LinkButton>
            <Button variant="ghost" onClick={() => router.push("/visitas")}>Depois</Button>
          </div>
        </div>
      ) : null}
      {marking ? (
        <PhotoMarker
          key={marking}
          photoId={marking}
          initial={v.photoMeta?.[marking]?.marks ?? []}
          onSave={(marks) => { setPhotoMarks(v.id, marking, marks); setMarking(null); }}
          onClose={() => setMarking(null)}
        />
      ) : null}
      {camera ? (
        <CameraCapture
          rooms={rooms.map((r) => r.name)}
          onShot={async (file, room) => { const { failed } = await addVisitPhotos(v.id, [file], room || undefined); if (failed) setMsg(photosFailedMessage(failed)); setPhotoSignal((n) => n + 1); }}
          onClose={() => setCamera(false)}
        />
      ) : null}
    </Screen>
  );
}
