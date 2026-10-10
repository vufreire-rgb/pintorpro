import { buildPdfData, MAX_PDF_PHOTOS, offersPix, type QuotePdfData } from "./pdfData";
import { normalizePixKey, pixPayload, pixText } from "./pix";
import { qrDataUrl } from "./qr";
import { formatBRL } from "@/shared/money";
import { buildIcs } from "./visitList";
import { buildReviewIcs, type ReviewReminder } from "./reminder";
import { buildWorkIcs } from "./workInfo";
import { buildChargeData, pixCodeFor } from "./chargeData";
import { chargeMessage, type InstallmentView } from "./finance";
import { buildReceiptData } from "./receiptData";
import type { Client, Payment, PhotoMark, Visit, Work } from "./types";
import { loadFileBlob, logoForPdf, markedPhotoBlob, photoForPdf } from "./photos";
import type { Db, Quote } from "./types";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Fotos que o pintor marcou "No PDF" na visita (até 6), já reduzidas. */
async function loadPdfPhotos(db: Db, q: Quote): Promise<QuotePdfData["photos"]> {
  const visit = db.visits.find((v) => v.id === q.visitId);
  if (!visit) return [];
  const chosen = visit.photoIds.filter((id) => visit.photoMeta?.[id]?.inPdf).slice(0, MAX_PDF_PHOTOS);
  const out: QuotePdfData["photos"] = [];
  for (const id of chosen) {
    const blob = await loadFileBlob(id);
    if (!blob) continue;
    try {
      out.push({ src: await photoForPdf(blob, visit.photoMeta?.[id]?.marks), room: visit.photoMeta?.[id]?.room ?? "", caption: visit.photoMeta?.[id]?.caption ?? "" });
    } catch {
      /* foto ilegível: pula */
    }
  }
  return out;
}

async function makePdf(db: Db, q: Quote): Promise<{ blob: Blob; data: QuotePdfData }> {
  const { renderQuotePdf } = await import("@/integrations/pdf/quotePdf");
  const logoId = db.company?.logoId;
  const logo = logoId ? await logoForPdf(logoId).catch(() => undefined) : undefined;
  const data: QuotePdfData = { ...buildPdfData(db, q, await loadPdfPhotos(db, q)), logo };
  const px = db.company?.pix;
  if (px && db.company && offersPix(q) && normalizePixKey(px.type, px.key)) {
    const pct = q.depositPct ?? db.company.depositPct ?? 50;
    const cents = Math.round((q.result.totals.totalCents * pct) / 100);
    const code = pixPayload(px, { name: db.company.name, city: db.company.city }, cents);
    if (code) data.pix = { qr: await qrDataUrl(code, 300), code, amount: formatBRL(cents), pct: `${pct}% do valor total.`, receiver: pixText(px.name || db.company.name, 25) };
  }
  return { blob: await renderQuotePdf(data), data };
}

/** Abre o compartilhamento do celular com o arquivo; se não houver, baixa e abre o WhatsApp com o texto. */
async function shareFileOnWhatsApp(blob: Blob, filename: string, text: string, title: string, rawPhone: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type || "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const phone = onlyDigits(rawPhone);
  window.open(`https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(text)}`, "_blank");
  return "downloaded";
}

/** Gera o PDF do orçamento e manda pelo WhatsApp. */
export async function sharePdfOnWhatsApp(db: Db, q: Quote): Promise<"shared" | "downloaded"> {
  const { blob, data } = await makePdf(db, q);
  const base = `Olá ${data.clientName}! Segue o orçamento nº ${data.number} — ${data.total}. Validade: ${data.validity.replace("7 dias, ", "")}.`;
  const text = data.pix ? `${base}\n\nPara pagar a entrada (${data.pix.amount}) por Pix, copie o código abaixo e cole no app do seu banco:\n${data.pix.code}` : base;
  return shareFileOnWhatsApp(blob, `orcamento-${data.number}.pdf`, text, `Orçamento ${data.number}`, db.clients.find((c) => c.id === q.clientId)?.phone ?? "");
}

/** Gera o PDF de cobrança de uma parcela (com QR do Pix) e manda pelo WhatsApp, com a mensagem pronta e o copia e cola. */
export async function shareCharge(db: Db, w: Work, p: InstallmentView): Promise<"shared" | "downloaded"> {
  const { renderChargePdf } = await import("@/integrations/pdf/chargePdf");
  const logoId = db.company?.logoId;
  const logo = logoId ? await logoForPdf(logoId).catch(() => undefined) : undefined;
  const open = p.amountCents - p.coveredCents;
  const code = pixCodeFor(db, open);
  const pix = code ? { code, qr: await qrDataUrl(code, 300) } : undefined;
  const data = { ...buildChargeData(db, w, p, pix), logo };
  const blob = await renderChargePdf(data);
  const client = db.clients.find((c) => c.id === w.clientId);
  const text = chargeMessage(p, client?.name ?? "", db.company?.name ?? "", code || undefined);
  return shareFileOnWhatsApp(blob, `cobranca-${data.number}-${p.label.toLowerCase().replace(/\s+/g, "-")}.pdf`, text, `Cobrança ${p.label}`, client?.phone ?? "");
}

/** Manda a foto do comprovante guardada no pagamento. */
export async function shareProof(db: Db, w: Work, payment: Payment): Promise<"shared" | "downloaded" | "missing"> {
  if (!payment.proofId) return "missing";
  const blob = await loadFileBlob(payment.proofId);
  if (!blob) return "missing";
  const client = db.clients.find((c) => c.id === w.clientId);
  const text = `Comprovante do pagamento de ${formatBRL(payment.amountCents)}${payment.note ? ` (${payment.note.toLowerCase()})` : ""}. Obrigado!${db.company?.name ? `\n— ${db.company.name}` : ""}`;
  return shareFileOnWhatsApp(blob, "comprovante.jpg", text, "Comprovante", client?.phone ?? "");
}

/** Gera o recibo de um pagamento e manda pelo WhatsApp. */
export async function shareReceipt(db: Db, w: Work, payment: Payment): Promise<"shared" | "downloaded"> {
  const { renderReceiptPdf } = await import("@/integrations/pdf/receiptPdf");
  const logoId = db.company?.logoId;
  const logo = logoId ? await logoForPdf(logoId).catch(() => undefined) : undefined;
  const data = { ...buildReceiptData(db, w, payment), logo };
  const blob = await renderReceiptPdf(data);
  const text = `Olá ${data.clientName.split(" ")[0] ?? ""}! Segue o recibo nº ${data.number} — ${data.amount}. Obrigado!`;
  return shareFileOnWhatsApp(blob, `recibo-${data.number}.pdf`, text, `Recibo ${data.number}`, db.clients.find((c) => c.id === w.clientId)?.phone ?? "");
}

export async function downloadPdf(db: Db, q: Quote): Promise<void> {
  const { blob } = await makePdf(db, q);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Baixa o compromisso (.ics): abre no calendário do celular, com alarme 1 hora antes. */
export function downloadVisitIcs(v: Visit, client?: Client): void {
  const url = URL.createObjectURL(new Blob([buildIcs(v, client)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "visita.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadWorkIcs(w: Work, client: Client | undefined, address: string): void {
  const url = URL.createObjectURL(new Blob([buildWorkIcs(w, client, address)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "obra.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadReviewIcs(r: ReviewReminder): void {
  const url = URL.createObjectURL(new Blob([buildReviewIcs(r, `${window.location.origin}/orcamentos`)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "lembrete-revisao.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Manda a foto com as marcações: abre o compartilhamento do celular; se não houver, baixa o arquivo. */
export async function shareMarkedPhoto(photoId: string, marks: PhotoMark[]): Promise<"shared" | "downloaded" | "missing"> {
  const original = await loadFileBlob(photoId);
  if (!original) return "missing";
  const blob = await markedPhotoBlob(original, marks);
  const file = new File([blob], "foto-marcada.jpg", { type: "image/jpeg" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      return "shared"; // o usuário fechou a janela de compartilhar
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "foto-marcada.jpg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
