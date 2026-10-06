"use client";
import { useEffect, useState } from "react";
import { cloudConfigured, downloadFile, removeCloudFile, uploadFile } from "@/repositories/cloudStore";
import { deleteFile, getFile, putFile } from "@/repositories/fileStore";
import { drawMarks } from "./markDraw";
import { getUserId } from "./session";
import type { PhotoMark } from "./types";

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

/** Quantos arquivos ainda não subiram para a nuvem. */
export const pendingUploadCount = (): number => readPending().length;

/** Reenvia o que ficou pendente (chamado após o login e quando a internet volta). */
export async function flushPendingUploads(): Promise<void> {
  for (const id of readPending()) {
    const blob = await getFile(id).catch(() => undefined);
    if (blob) await pushToCloud(id, blob);
    else writePending(readPending().filter((x) => x !== id));
  }
}

/** A foto não pôde ser lida. Nesse caso ela NÃO é guardada (o arquivo original pode ter EXIF/GPS). */
export class PhotoReadError extends Error {}

interface Decoded { source: CanvasImageSource; width: number; height: number; release: () => void }

/** Abre a imagem já com a rotação certa. Se o navegador não tiver `createImageBitmap` com orientação, usa um <img>. */
async function decode(file: File): Promise<Decoded> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoReadError("decode");
    }
  }
}

/**
 * Reduz a foto (lado maior 1600 px) e salva um JPEG NOVO, desenhado do zero: isso remove EXIF e GPS.
 * Nunca devolve o arquivo original: se não der para reler a foto, avisa com PhotoReadError.
 */
async function compress(file: File): Promise<Blob> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new PhotoReadError("empty");
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.78));
    if (!blob) throw new PhotoReadError("encode");
    return blob;
  } finally {
    img.release();
  }
}

/** Guarda as fotos que foi possível ler. `failed` = quantas não puderam ser lidas (e por isso não foram guardadas). */
export async function storePhotos(files: File[]): Promise<{ ids: string[]; failed: number }> {
  const ids: string[] = [];
  let failed = 0;
  for (const f of files) {
    try {
      const blob = await compress(f);
      const id = crypto.randomUUID();
      await putFile(id, blob);
      void pushToCloud(id, blob);
      ids.push(id);
    } catch {
      failed += 1;
    }
  }
  return { ids, failed };
}

export const photosFailedMessage = (failed: number): string =>
  `Não consegui ler ${failed === 1 ? "1 foto" : `${failed} fotos`}, então ${failed === 1 ? "ela não foi guardada" : "elas não foram guardadas"}. Tire de novo ou escolha outra.`;

/** Logo do pintor: reduzido (lado maior 500 px) em PNG, para manter fundo transparente. */
export async function storeLogo(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 500 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("logo");
  const id = crypto.randomUUID();
  await putFile(id, blob);
  void pushToCloud(id, blob);
  return id;
}

/** Logo como data URL para o PDF (ou undefined se não der para ler). */
export async function logoForPdf(id: string): Promise<string | undefined> {
  const blob = await loadFileBlob(id);
  if (!blob) return undefined;
  return await new Promise<string | undefined>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : undefined);
    r.onerror = () => resolve(undefined);
    r.readAsDataURL(blob);
  });
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

/** Desenha a foto reduzida (lado maior `maxSide`) já com as marcações por cima. */
async function drawPhoto(blob: Blob, maxSide: number, marks?: PhotoMark[]): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (marks?.length) drawMarks(ctx, canvas.width, canvas.height, marks);
  return canvas;
}

/** Reduz uma foto para o PDF (lado maior 900 px, JPEG), com as marcações, e devolve como data URL. */
export async function photoForPdf(blob: Blob, marks?: PhotoMark[]): Promise<string> {
  return (await drawPhoto(blob, 900, marks)).toDataURL("image/jpeg", 0.8);
}

/** Foto com marcações como arquivo JPEG (para mandar pelo WhatsApp). */
export async function markedPhotoBlob(blob: Blob, marks: PhotoMark[]): Promise<Blob> {
  const canvas = await drawPhoto(blob, MAX_SIDE, marks);
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return out ?? blob;
}

/** Miniatura com as marcações; null enquanto carrega ou se não há marcações. */
export function useMarkedUrl(id: string, marks?: PhotoMark[]): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const key = marks?.length ? JSON.stringify(marks) : "";
  useEffect(() => {
    let alive = true;
    let revoke: string | null = null;
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    loadFileBlob(id)
      .then(async (blob) => {
        if (!blob) return;
        const canvas = await drawPhoto(blob, 600, JSON.parse(key) as PhotoMark[]);
        const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
        if (!alive || !out) return;
        revoke = URL.createObjectURL(out);
        setUrl(revoke);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id, key]);
  return url;
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
