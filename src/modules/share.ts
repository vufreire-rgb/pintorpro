import { buildPdfData, MAX_PDF_PHOTOS, type QuotePdfData } from "./pdfData";
import { buildIcs } from "./visitList";
import { buildWorkIcs } from "./workInfo";
import type { Client, Visit, Work } from "./types";
import { loadFileBlob, logoForPdf, photoForPdf } from "./photos";
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
      out.push({ src: await photoForPdf(blob), room: visit.photoMeta?.[id]?.room ?? "", caption: visit.photoMeta?.[id]?.caption ?? "" });
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
  const data = { ...buildPdfData(db, q, await loadPdfPhotos(db, q)), logo };
  return { blob: await renderQuotePdf(data), data };
}

/** Gera o PDF e abre o compartilhamento do celular; se não houver, baixa o PDF e abre o WhatsApp. */
export async function sharePdfOnWhatsApp(db: Db, q: Quote): Promise<"shared" | "downloaded"> {
  const { blob, data } = await makePdf(db, q);
  const file = new File([blob], `orcamento-${data.number}.pdf`, { type: "application/pdf" });
  const text = `Olá ${data.clientName}! Segue o orçamento nº ${data.number} — ${data.total}. Validade: ${data.validity.replace("7 dias, ", "")}.`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: `Orçamento ${data.number}` });
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
  const phone = onlyDigits(db.clients.find((c) => c.id === q.clientId)?.phone ?? "");
  const wa = `https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(text)}`;
  window.open(wa, "_blank");
  return "downloaded";
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
