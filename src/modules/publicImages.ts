/** Imagens da página pública: reduzidas e salvas como JPEG novo (sem EXIF nem GPS), prontas para ir dentro da página. */

export const AVATAR_MAX_CHARS = 80_000;
export const PHOTO_MAX_CHARS = 260_000;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
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
      throw new Error("decode");
    }
  }
}

const toDataUrl = (canvas: HTMLCanvasElement, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("encode"));
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("encode"));
      r.readAsDataURL(blob);
    }, "image/jpeg", quality);
  });

/**
 * Reduz a imagem até caber em `maxChars` (diminui a qualidade e, se preciso, o tamanho).
 * `square` recorta o centro em quadrado (foto de perfil).
 */
export async function imageToDataUrl(file: File, opts: { side: number; maxChars: number; square?: boolean }): Promise<string> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new Error("empty");
    const crop = opts.square ? Math.min(img.width, img.height) : 0;
    const sx = opts.square ? (img.width - crop) / 2 : 0;
    const sy = opts.square ? (img.height - crop) / 2 : 0;
    const sw = opts.square ? crop : img.width;
    const sh = opts.square ? crop : img.height;
    let side = opts.side;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      for (const q of [0.8, 0.7, 0.6, 0.5]) {
        const url = await toDataUrl(canvas, q);
        if (url.length <= opts.maxChars) return url;
      }
      side = Math.round(side * 0.8);
    }
    throw new Error("too_big");
  } finally {
    img.release();
  }
}

export const toAvatar = (file: File): Promise<string> => imageToDataUrl(file, { side: 320, maxChars: AVATAR_MAX_CHARS, square: true });
export const toWorkPhoto = (file: File): Promise<string> => imageToDataUrl(file, { side: 1000, maxChars: PHOTO_MAX_CHARS - 20_000 });

/**
 * Reduz uma imagem que já é data URL (logo, foto do PDF) para JPEG pequeno, com fundo branco.
 * Devolve undefined se não der para ler ou não couber no limite.
 */
export async function shrinkDataUrl(src: string, opts: { side: number; maxChars: number }): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) return undefined;
    let side = opts.side;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.78, 0.68, 0.58, 0.48]) {
        const url = await toDataUrl(canvas, q);
        if (url.length <= opts.maxChars) return url;
      }
      side = Math.round(side * 0.8);
    }
  } catch { /* imagem ilegível: o link sai sem ela */ }
  return undefined;
}
