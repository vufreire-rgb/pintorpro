import { uid, updateDb } from "./db";
import { removePhotoFile, saveAudioFile, storePhotos } from "./photos";
import { addClient } from "./clients";
import type { RoomDraft } from "./rooms";
import type { AudioMarker, Client, Db, GeoPoint, PhotoMark, Visit } from "./types";

const blankVisit = (): Visit => ({ id: uid(), siteAddress: "", notes: "", photoIds: [], createdAt: new Date().toISOString() });

/** Visita rápida: nasce na hora, já iniciada e SEM cliente (ele é definido depois). */
export function createQuickVisit(): string {
  const now = new Date().toISOString();
  const visit: Visit = { ...blankVisit(), startedAt: now };
  updateDb((d) => ({ ...d, visits: [visit, ...d.visits] }));
  return visit.id;
}

/** Visita de treino do guia: cliente e endereço de exemplo, já iniciada. Apagar a visita apaga o cliente de exemplo. */
export function createExampleVisit(): string {
  const client: Client = { id: uid(), name: "Cliente Exemplo", phone: "(11) 99999-0000", address: "Rua Exemplo, 123", isExample: true };
  const visit: Visit = { ...blankVisit(), clientId: client.id, siteAddress: client.address, startedAt: new Date().toISOString(), isExample: true };
  updateDb((d) => ({ ...d, clients: [client, ...d.clients], visits: [visit, ...d.visits] }));
  return visit.id;
}

/** Agenda uma visita futura. Se não escolheu cliente existente e informou um nome, cadastra o cliente. */
export function createScheduledVisit(db: Db, data: { clientId?: string; name?: string; phone?: string; address: string; scheduledAt: string; notes?: string }): string {
  const existing = data.clientId ? db.clients.find((c) => c.id === data.clientId) : undefined;
  const clientId = existing?.id ?? (data.name?.trim() ? addClient({ name: data.name.trim(), phone: data.phone ?? "", address: data.address }).id : undefined);
  const visit: Visit = { ...blankVisit(), clientId, siteAddress: data.address || existing?.address || "", scheduledAt: data.scheduledAt, notes: data.notes ?? "" };
  updateDb((d) => ({ ...d, visits: [visit, ...d.visits] }));
  return visit.id;
}

const patch = (id: string, fn: (v: Visit) => Visit) =>
  updateDb((d) => ({ ...d, visits: d.visits.map((v) => (v.id === id ? fn(v) : v)) }));

export const setVisitClient = (id: string, clientId: string) =>
  updateDb((d) => {
    const c = d.clients.find((x) => x.id === clientId);
    return { ...d, visits: d.visits.map((v) => (v.id === id ? { ...v, clientId, siteAddress: v.siteAddress || c?.address || "" } : v)) };
  });

/** Cadastra o cliente e já liga à visita. */
export function createClientForVisit(id: string, data: { name: string; phone: string; address: string }): void {
  const client = addClient(data);
  patch(id, (v) => ({ ...v, clientId: client.id, siteAddress: v.siteAddress || data.address }));
}

/** Marca que a visita agendada começou agora. */
export const startVisit = (id: string) => patch(id, (v) => ({ ...v, startedAt: new Date().toISOString() }));
export const rescheduleVisit = (id: string, scheduledAt: string) => patch(id, (v) => ({ ...v, scheduledAt, startedAt: undefined }));
export const setRecordingConsent = (id: string) => patch(id, (v) => ({ ...v, recordingConsent: true }));

/** Cria (sem `roomId`) ou atualiza um ambiente da visita com as paredes anotadas. */
export function saveVisitRoom(id: string, draft: RoomDraft, roomId?: string): void {
  patch(id, (v) => {
    const rooms = v.rooms ?? [];
    const name = draft.name.trim() || `Ambiente ${rooms.length + 1}`;
    const prev = rooms.find((r) => r.id === roomId);
    const room = { lengthM: 0, widthM: 0, heightM: 2.7, condition: "pintada", ...prev, id: roomId ?? uid(), name, surfaces: draft.surfaces, doors: draft.doors, windows: draft.windows };
    return { ...v, rooms: prev ? rooms.map((r) => (r.id === roomId ? room : r)) : [...rooms, room] };
  });
}
export const removeVisitRoom = (id: string, roomId: string) => patch(id, (v) => ({ ...v, rooms: (v.rooms ?? []).filter((r) => r.id !== roomId) }));

export const setVisitNotes = (id: string, notes: string) => patch(id, (v) => ({ ...v, notes }));
/** Guarda o ponto no mapa; se veio um endereço escrito, ele passa a ser o endereço da obra. */
export const setVisitLocation = (id: string, location: GeoPoint, address?: string) =>
  patch(id, (v) => ({ ...v, location, siteAddress: address || v.siteAddress }));

export const setVisitAddress = (id: string, siteAddress: string) => patch(id, (v) => ({ ...v, siteAddress }));

/** Guarda as fotos. `room`: ambiente anotado na hora (vira o rótulo da foto no PDF). Retorna os ids. */
export async function addVisitPhotos(id: string, files: File[], room?: string): Promise<string[]> {
  const ids = await storePhotos(files);
  patch(id, (v) => ({
    ...v,
    photoIds: [...v.photoIds, ...ids],
    photoMeta: room ? { ...v.photoMeta, ...Object.fromEntries(ids.map((pid) => [pid, { ...v.photoMeta?.[pid], room }])) } : v.photoMeta,
  }));
  return ids;
}

export async function removeVisitPhoto(id: string, photoId: string): Promise<void> {
  patch(id, (v) => ({ ...v, photoIds: v.photoIds.filter((p) => p !== photoId) }));
  await removePhotoFile(photoId);
}

export async function addVisitAudio(id: string, blob: Blob, seconds: number, markers: AudioMarker[] = []): Promise<void> {
  const note = { id: await saveAudioFile(blob), seconds, createdAt: new Date().toISOString(), mime: blob.type, markers };
  patch(id, (v) => ({ ...v, audios: [...(v.audios ?? []), note] }));
}

export async function removeVisitAudio(id: string, audioId: string): Promise<void> {
  patch(id, (v) => ({ ...v, audios: (v.audios ?? []).filter((a) => a.id !== audioId) }));
  await removePhotoFile(audioId);
}

/** Apaga a visita e seus arquivos (fotos e áudios), no aparelho e na nuvem. */
export async function deleteVisit(id: string, visits: Visit[]): Promise<void> {
  const v = visits.find((x) => x.id === id);
  updateDb((d) => ({
    ...d,
    visits: d.visits.filter((x) => x.id !== id),
    clients: v?.isExample ? d.clients.filter((c) => !(c.isExample && c.id === v.clientId)) : d.clients,
  }));
  if (!v) return;
  await Promise.all([...v.photoIds, ...(v.audios ?? []).map((a) => a.id)].map((fid) => removePhotoFile(fid)));
}

export type PhotoMeta = NonNullable<Visit["photoMeta"]>[string];

/** Marca/desmarca a foto para o PDF (até 6) e guarda legenda/ambiente. Retorna false se já há 6. */
/** Guarda (ou limpa) as marcações desenhadas na foto. A foto original não muda. */
export const setPhotoMarks = (visitId: string, photoId: string, marks: PhotoMark[]) =>
  patch(visitId, (v) => ({ ...v, photoMeta: { ...(v.photoMeta ?? {}), [photoId]: { ...(v.photoMeta ?? {})[photoId], marks: marks.length ? marks : undefined } } }));

export function setPhotoMeta(visitId: string, photoId: string, meta: Partial<PhotoMeta>, maxInPdf: number): boolean {
  let ok = true;
  patch(visitId, (v) => {
    const all = v.photoMeta ?? {};
    const already = Object.values(all).filter((m) => m.inPdf).length;
    if (meta.inPdf && !all[photoId]?.inPdf && already >= maxInPdf) {
      ok = false;
      return v;
    }
    return { ...v, photoMeta: { ...all, [photoId]: { ...all[photoId], ...meta } } };
  });
  return ok;
}
