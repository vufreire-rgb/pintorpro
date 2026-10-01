import { uid, updateDb } from "./db";
import { removePhotoFile, storePhotos } from "./photos";
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
