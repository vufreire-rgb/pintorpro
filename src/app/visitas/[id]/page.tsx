"use client";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { CameraCapture } from "@/components/CameraCapture";
import { ContactActions } from "@/components/ContactActions";
import { PhotoMarker } from "@/components/PhotoMarker";
import { PhotoGrid } from "@/components/PhotoGrid";
import { RoomEditor } from "@/components/RoomEditor";
import { AutoTour, type TourStep } from "@/components/Tour";
import { Button, buttonCls, Card, CardTitle, Chip, ConfirmDialog, Field, LinkButton, Loading, Screen, TextArea, TextArea2, TextInput } from "@/components/ui";
import { AlarmClock, CalendarDays, CalendarPlus, Camera, Check, Image as ImageIcon, MapPin, MessageCircle, Mic, Play, Plus, Ruler, Trash2, User, X } from "lucide-react";
import { cloudEnabled } from "@/modules/auth";
import { GEO_MESSAGE, GeoError, getPosition, reverseGeocode } from "@/modules/geo";
import { MAX_PDF_PHOTOS } from "@/modules/pdfData";
import { photosFailedMessage } from "@/modules/photos";
import { blankRoom, legacyToSurfaces, surfacesSummary, type RoomDraft } from "@/modules/rooms";
import { downloadVisitIcs } from "@/modules/share";
import { useAppDb } from "@/modules/useApp";
import { isSimpleMode } from "@/modules/settings";
import { addVisitPhotos, createClientForVisit, deleteVisit, removeVisitPhoto, removeVisitRoom, rescheduleVisit, setPhotoMarks, setPhotoMeta, setVisitAddress, setVisitLocation, setVisitClient, saveVisitRoom, setVisitNotes, startVisit } from "@/modules/visits";
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
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "" });
  const [draft, setDraft] = useState<RoomDraft>({ name: "", surfaces: [], doors: 1, windows: 1 });
  const [when, setWhen] = useState("");
  if (!db) return <Loading />;
  const v = db.visits.find((x) => x.id === id);
  if (!v) return <Screen title="Visita" back="/visitas"><p>Visita não encontrada.</p></Screen>;
  const client = v.clientId ? db.clients.find((c) => c.id === v.clientId) : undefined;
  const state = visitState(v);
  const rooms = v.rooms ?? [];
  const simple = isSimpleMode(db.company);
  const steps: TourStep[] = ([
    { target: "cliente", title: "Cliente e endereço", text: "Aqui ficam o cliente e o endereço da obra. Já deixei um cliente de exemplo. Num cliente de verdade, toque em Usar minha localização para preencher o endereço." },
    { target: "fotos", title: "Fotos da obra", text: "Tire várias fotos. Depois toque no lápis para marcar setas e textos, e em + PDF para a foto aparecer no orçamento." },
    { target: "medidas", title: "Medidas por parede", text: "Toque em Anotar as medidas, escreva a largura e a altura da Parede 1 e use + Parede para as outras. Escolha o tipo de pintura de cada uma e salve.", done: rooms.length > 0 },
    { target: "observacoes", title: "Observações", text: "Escreva o que o cliente pediu e os problemas que viu, como mofo ou trincas. Isso fica guardado com a visita." },
    { target: "orcar", title: "Montar o orçamento", text: simple ? "Quando terminar, toque aqui para fechar o preço com o cliente. Vou te mostrar o orçamento agora." : "Quando terminar, toque aqui. As medidas que você anotou já vão para o orçamento, sem digitar de novo. Vou te mostrar o orçamento agora.", button: "Ir para o orçamento" },
  ] as TourStep[]).filter((st) => !(simple && st.target === "medidas"));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { failed } = await addVisitPhotos(v.id, Array.from(files));
      setMsg(failed ? photosFailedMessage(failed) : "");
    } finally { setBusy(false); }
    if (input.current) input.current.value = "";
  };

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
          <div className="font-display text-[28px] font-bold leading-[34px] text-brand">{whenLabel(v.scheduledAt)}</div>
          <Button variant="ghost" icon={Play} onClick={() => startVisit(v.id)}>Começar a visita agora</Button>
          {client?.phone ? <a className={buttonCls("ghost")} href={waUrl(client.phone, confirmationText(v, client, db.company))} target="_blank" rel="noreferrer"><MessageCircle size={24} strokeWidth={2.2} aria-hidden />Confirmar pelo WhatsApp</a> : null}
          <Button variant="ghost" icon={CalendarPlus} onClick={() => downloadVisitIcs(v, client)}>Adicionar à agenda do celular</Button>
          <Field label="Mudar dia e hora"><TextInput type="datetime-local" value={when || toLocalInput(v.scheduledAt)} onChange={(e) => setWhen(e.target.value)} /></Field>
          {when ? <Button variant="ghost" onClick={() => { rescheduleVisit(v.id, fromLocalInput(when)); setWhen(""); }}>Salvar novo horário</Button> : null}
        </Card>
      ) : (
        <div className="text-base text-support">Visita de {fmtDate(v.startedAt ?? v.createdAt)} · guardada automaticamente · toque em <b>Salvar visita</b> ao terminar</div>
      )}

      <div data-tour="cliente">
      <Card className="flex flex-col gap-3">
        {client && !changing ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold">{client.name}</div>
                {client.phone ? <div className="text-support">{client.phone}</div> : null}
              </div>
              <button className="min-h-10 px-2 text-brand underline" onClick={() => setChanging(true)}>Trocar</button>
            </div>
            <ContactActions phone={client.phone} address={v.siteAddress || client.address} location={v.location} />
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
          ) : <p className="flex items-start gap-2 text-lg text-support"><User size={24} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0" />O nome e o telefone do cliente você coloca na hora de salvar a visita.</p>
        )}
        <Field label="Endereço da obra"><TextArea2 value={v.siteAddress} onChange={(e) => setVisitAddress(v.id, e.target.value)} /></Field>
        <Button variant="ghost" icon={MapPin} disabled={locating} onClick={fillFromLocation}>{locating ? "Buscando sua posição…" : v.location ? "Atualizar pela minha localização" : "Usar minha localização"}</Button>
        {v.location ? <p className="text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden className="mr-1 inline" />Ponto no mapa salvo{v.location.accuracy ? ` (precisão de cerca de ${v.location.accuracy} m)` : ""}. <a className="underline" href={mapsUrl(v.siteAddress, v.location)} target="_blank" rel="noreferrer">Abrir no mapa</a></p> : null}
        {geoMsg ? <p className="text-base text-ink">{geoMsg}</p> : null}
        {fromOsm ? <p className="text-base text-support">Endereço sugerido com dados © colaboradores do <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p> : null}
      </Card>
      </div>

      <Card><AudioRecorder visitId={v.id} audios={v.audios ?? []} consent={!!v.recordingConsent} /></Card>

      <div data-tour="fotos">
      <Card className="flex flex-col gap-3">
        <CardTitle icon={Camera}>Fotos ({v.photoIds.length})</CardTitle>
        <PhotoGrid
          ids={v.photoIds}
          marksOf={(pid) => v.photoMeta?.[pid]?.marks}
          onMark={setMarking}
          onRemove={(pid) => removeVisitPhoto(v.id, pid)}
          selectedIds={v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf)}
          onToggle={(pid) => setPhotoMeta(v.id, pid, { inPdf: !v.photoMeta?.[pid]?.inPdf }, MAX_PDF_PHOTOS) || setMsg(`Máximo de ${MAX_PDF_PHOTOS} fotos no PDF.`)}
        />
        {v.photoIds.some((pid) => v.photoMeta?.[pid]?.inPdf) ? (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
            <b className="text-base">Fotos no PDF do cliente</b>
            {v.photoIds.filter((pid) => v.photoMeta?.[pid]?.inPdf).map((pid, i) => (
              <div key={pid} className="flex flex-col gap-2">
                <TextInput placeholder={`Foto ${i + 1}: ambiente`} value={v.photoMeta?.[pid]?.room ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { room: e.target.value }, MAX_PDF_PHOTOS)} />
                <TextArea2 placeholder="Legenda" value={v.photoMeta?.[pid]?.caption ?? ""} onChange={(e) => setPhotoMeta(v.id, pid, { caption: e.target.value }, MAX_PDF_PHOTOS)} />
              </div>
            ))}
          </div>
        ) : v.photoIds.length > 0 ? <p className="text-base text-support">Toque em <b>+ PDF</b> nas fotos que quer mostrar no orçamento (até {MAX_PDF_PHOTOS}) e no <b>lápis</b> para desenhar setas, textos e medidas.</p> : null}
        {msg ? <p className="text-base text-err">{msg}</p> : null}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid="photo-input" />
        <Button variant="ghost" icon={Camera} onClick={() => setCamera(true)}>Tirar fotos (várias)</Button>
        <Button variant="ghost" icon={ImageIcon} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Guardando…" : "Escolher da galeria"}</Button>
        <p className="text-base text-support">{cloudEnabled ? "Suas fotos ficam guardadas na sua conta." : "As fotos ficam guardadas neste aparelho."}</p>
      </Card>
      </div>

      {simple ? null : <div data-tour="medidas">
      <Card className="flex flex-col gap-3">
        <CardTitle icon={Ruler}>Medidas ({rooms.length})</CardTitle>
        {rooms.length === 0 ? <p className="text-base text-support">Anote aqui os ambientes e as medidas. Eles já viram o orçamento, sem digitar de novo.</p> : null}
        {rooms.map((r) => editing === r.id ? null : (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => { setDraft({ name: r.name, surfaces: r.surfaces?.length ? r.surfaces : legacyToSurfaces(r.lengthM, r.widthM, r.heightM), doors: r.doors, windows: r.windows }); setEditing(r.id); }} aria-label={`Editar ${r.name}`}>
              <b>{r.name}</b>
              <div className="text-base text-support">{r.surfaces?.length ? `${plural(r.surfaces.filter((s) => s.kind === "wall").length, "parede", "paredes")} · ${surfacesSummary(r.surfaces, r.doors, r.windows)}` : `${fmtNum(r.lengthM)} × ${fmtNum(r.widthM)} m · altura ${fmtNum(r.heightM)} m`} · {plural(r.doors, "porta", "portas")} · {plural(r.windows, "janela", "janelas")}</div>
            </button>
            <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100" aria-label={`Remover ${r.name}`} onClick={() => removeVisitRoom(v.id, r.id)}><X size={20} strokeWidth={2.4} aria-hidden /></button>
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
        ) : (
          <Button variant="ghost" icon={rooms.length ? Plus : Ruler} onClick={() => { const b = blankRoom(rooms.length + 1); setDraft({ name: b.name, surfaces: b.surfaces!, doors: b.doors, windows: b.windows }); setEditing("novo"); }}>{rooms.length ? "Anotar outro ambiente" : "Anotar as medidas de um ambiente"}</Button>
        )}
      </Card>
      </div>}

      <div data-tour="observacoes">
      <Field label="Observações" hint="O que o cliente pediu, problemas que viu…">
        <TextArea value={v.notes} onChange={(e) => setVisitNotes(v.id, e.target.value)} placeholder="Ex.: Cliente quer cor branco gelo, parede com mofo perto da janela…" />
      </Field>
      </div>

      <LinkButton href={`/orcamentos/voz?visita=${v.id}`} icon={Mic} variant={simple ? "primary" : "ghost"}>Ditar orçamento</LinkButton>
      <div data-tour="orcar"><LinkButton href={`/orcamentos/novo?visita=${v.id}`} variant="ghost">{v.quoteId ? "Montar outro orçamento" : "Montar orçamento"}</LinkButton></div>
      {v.quoteId ? <LinkButton href={`/orcamentos/${v.quoteId}`} variant="ghost">Ver orçamento feito</LinkButton> : null}
      <Button variant="danger" icon={Trash2} onClick={() => setAskDelete(true)}>Apagar visita</Button>
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button icon={Check} onClick={() => (client ? router.push("/visitas") : setSaving(true))}>Salvar visita</Button>
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
                {db.clients.map((c) => <Chip key={c.id} active={false} onClick={() => { setVisitClient(v.id, c.id); router.push("/visitas"); }}>{c.name}</Chip>)}
              </div>
            ) : null}
            <Field label={db.clients.length > 0 ? "Ou cadastre um novo: nome" : "Nome do cliente"}><TextInput value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
            <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            <Button disabled={!newClient.name.trim()} onClick={() => { createClientForVisit(v.id, { ...newClient, address: v.siteAddress }); router.push("/visitas"); }}>Salvar visita</Button>
            <Button variant="ghost" onClick={() => setSaving(false)}>Voltar</Button>
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
          onShot={async (file, room) => { const { failed } = await addVisitPhotos(v.id, [file], room || undefined); if (failed) setMsg(photosFailedMessage(failed)); }}
          onClose={() => setCamera(false)}
        />
      ) : null}
      <AutoTour id="visita" steps={steps} enabled={!!v.isExample} onFinish={() => router.push(`/orcamentos/novo?visita=${v.id}`)} />
    </Screen>
  );
}
