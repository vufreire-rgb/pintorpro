import { uid, updateDb } from "./db";
import { removePhotoFile, saveAudioFile, storePhotos } from "./photos";
import { addClient } from "./clients";
import type { Db, Visit } from "./types";

/** Cria a visita; se não escolheu cliente existente, cadastra um novo. */
export function createVisit(db: Db, data: { clientId?: string; name: string; phone: string; address: string }): string {
  const client = data.clientId ? db.clients.find((c) => c.id === data.clientId) : undefined;
  const clientId = client?.id ?? addClient({ name: data.name, phone: data.phone, address: data.address }).id;
  const visit: Visit = {
    id: uid(),
    clientId,
    siteAddress: data.address || client?.address || "",
    notes: "",
    photoIds: [],
    createdAt: new Date().toISOString(),
  };
  updateDb((d) => ({ ...d, visits: [visit, ...d.visits] }));
  return visit.id;
}

const patch = (id: string, fn: (v: Visit) => Visit) =>
  updateDb((d) => ({ ...d, visits: d.visits.map((v) => (v.id === id ? fn(v) : v)) }));

export const setVisitNotes = (id: string, notes: string) => patch(id, (v) => ({ ...v, notes }));
export const setVisitAddress = (id: string, siteAddress: string) => patch(id, (v) => ({ ...v, siteAddress }));

export async function addVisitPhotos(id: string, files: File[]): Promise<void> {
  const ids = await storePhotos(files);
  patch(id, (v) => ({ ...v, photoIds: [...v.photoIds, ...ids] }));
}

export async function removeVisitPhoto(id: string, photoId: string): Promise<void> {
  patch(id, (v) => ({ ...v, photoIds: v.photoIds.filter((p) => p !== photoId) }));
  await removePhotoFile(photoId);
}

export async function addVisitAudio(id: string, blob: Blob, seconds: number): Promise<void> {
  const note = { id: await saveAudioFile(blob), seconds, createdAt: new Date().toISOString(), mime: blob.type };
  patch(id, (v) => ({ ...v, audios: [...(v.audios ?? []), note] }));
}

export async function removeVisitAudio(id: string, audioId: string): Promise<void> {
  patch(id, (v) => ({ ...v, audios: (v.audios ?? []).filter((a) => a.id !== audioId) }));
  await removePhotoFile(audioId);
}

/** Apaga a visita e seus arquivos (fotos e áudios), no aparelho e na nuvem. */
export async function deleteVisit(id: string, visits: Visit[]): Promise<void> {
  const v = visits.find((x) => x.id === id);
  updateDb((d) => ({ ...d, visits: d.visits.filter((x) => x.id !== id) }));
  if (!v) return;
  await Promise.all([...v.photoIds, ...(v.audios ?? []).map((a) => a.id)].map((fid) => removePhotoFile(fid)));
}
