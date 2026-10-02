"use client";
import { useEffect, useState } from "react";
import { cloudConfigured, downloadFile, removeCloudFile, uploadFile } from "@/repositories/cloudStore";
import { deleteFile, getFile, putFile } from "@/repositories/fileStore";
import { getUserId } from "./session";

const MAX_SIDE = 1600;
const PENDING_KEY = "pintorpro:pending-uploads";

const readPending = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const writePending = (ids: string[]) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignora */
  }
};

/** Envia o arquivo para a nuvem; se falhar (sem internet), fica na fila para tentar de novo. */
async function pushToCloud(id: string, blob: Blob): Promise<void> {
  const uid = getUserId();
  if (!cloudConfigured || !uid) return;
  try {
    await uploadFile(uid, id, blob);
    writePending(readPending().filter((x) => x !== id));
  } catch {
    writePending([...readPending(), id]);
  }
}

/** Reenvia o que ficou pendente (chamado após o login e quando a internet volta). */
export async function flushPendingUploads(): Promise<void> {
  for (const id of readPending()) {
    const blob = await getFile(id).catch(() => undefined);
    if (blob) await pushToCloud(id, blob);
    else writePending(readPending().filter((x) => x !== id));
  }
}

/** Reduz a foto (lado maior 1600 px, JPEG) para não encher a memória do celular. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.78));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function storePhotos(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    const id = crypto.randomUUID();
    const blob = await compress(f);
    await putFile(id, blob);
    void pushToCloud(id, blob);
    ids.push(id);
  }
  return ids;
}

export async function saveAudioFile(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await putFile(id, blob);
  void pushToCloud(id, blob);
  return id;
}

export async function removePhotoFile(id: string): Promise<void> {
  await deleteFile(id).catch(() => undefined);
  const uid = getUserId();
  if (cloudConfigured && uid) await removeCloudFile(uid, id).catch(() => undefined);
}

/** Lê o arquivo do aparelho; se não estiver aqui, baixa da nuvem e guarda para a próxima vez. */
export async function loadFileBlob(id: string): Promise<Blob | undefined> {
  const local = await getFile(id).catch(() => undefined);
  if (local) return local;
  const uid = getUserId();
  const remote = cloudConfigured && uid ? await downloadFile(uid, id).catch(() => null) : null;
  if (remote) await putFile(id, remote).catch(() => undefined);
  return remote ?? undefined;
}

/** Reduz uma foto para o PDF (lado maior 900 px, JPEG) e devolve como data URL. */
export async function photoForPdf(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** URL temporária para exibir um arquivo (foto ou áudio); null enquanto carrega ou se não existe neste aparelho. */
export function useFileUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;
    getFile(id)
      .then(async (local) => {
        if (local) return local;
        // Não está neste aparelho: tenta baixar da nuvem e guarda aqui para a próxima vez.
        const uid = getUserId();
        const remote = cloudConfigured && uid ? await downloadFile(uid, id) : null;
        if (remote) await putFile(id, remote).catch(() => undefined);
        return remote ?? undefined;
      })
      .then((blob) => {
        if (!alive || !blob) return;
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);
  return url;
}

export const usePhotoUrl = useFileUrl;
