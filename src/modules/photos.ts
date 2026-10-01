"use client";
import { useEffect, useState } from "react";
import { deleteFile, getFile, putFile } from "@/repositories/fileStore";

const MAX_SIDE = 1600;

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
    await putFile(id, await compress(f));
    ids.push(id);
  }
  return ids;
}

export async function saveAudioFile(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await putFile(id, blob);
  return id;
}

export const removePhotoFile = (id: string) => deleteFile(id).catch(() => undefined);

/** URL temporária para exibir um arquivo (foto ou áudio); null enquanto carrega ou se não existe neste aparelho. */
export function useFileUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;
    getFile(id)
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
