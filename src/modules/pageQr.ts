import { qrDataUrl } from "./qr";

/**
 * Cartaz do QR code para imprimir ou mandar (PNG 1080×1350): nome do negócio, QR grande, o link e uma chamada curta.
 * Desenhado do zero em canvas, sem enviar nada para fora.
 */
export async function pageQrPoster(opts: { company: string; url: string; color: string }): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  g.fillStyle = opts.color;
  g.fillRect(0, 0, W, 300);

  const font = (px: number, w = 700) => `${w} ${px}px Outfit, "Atkinson Hyperlegible", Arial, sans-serif`;
  const fit = (text: string, px: number, max: number) => {
    let size = px;
    g.font = font(size);
    while (g.measureText(text).width > max && size > 28) { size -= 2; g.font = font(size); }
  };

  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fit(opts.company, 78, W - 140);
  g.fillText(opts.company, W / 2, 125);
  g.font = font(44, 500);
  g.fillText("Pintura com capricho", W / 2, 210);

  const qr = new Image();
  qr.src = await qrDataUrl(opts.url, 760);
  await qr.decode();
  g.drawImage(qr, (W - 700) / 2, 360, 700, 700);

  g.fillStyle = "#0e1b2e";
  g.font = font(52);
  g.fillText("Aponte a câmera e peça", W / 2, 1130);
  g.fillText("seu orçamento", W / 2, 1195);
  g.fillStyle = opts.color;
  fit(opts.url.replace(/^https?:\/\//, ""), 44, W - 140);
  g.fillText(opts.url.replace(/^https?:\/\//, ""), W / 2, 1275);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
