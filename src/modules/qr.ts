/** QR Code como imagem (data URL). Carrega a biblioteca só quando precisa. */
export async function qrDataUrl(text: string, width = 360): Promise<string> {
  const QR = await import("qrcode");
  return QR.toDataURL(text, { margin: 1, width, errorCorrectionLevel: "M" });
}
