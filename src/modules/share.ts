import { formatBRL } from "@/shared/money";
import { fmtDate, fmtNum, UNIT_LABEL } from "@/shared/format";
import type { Db, Quote } from "./types";

/** Monta os dados do cliente. Nunca inclui custo, lucro ou margem. */
export function buildPdfData(db: Db, q: Quote) {
  const client = db.clients.find((c) => c.id === q.clientId);
  const rooms = q.input.rooms
    .map((r) => ({
      name: r.name,
      lines: q.result.serviceLines
        .filter((l) => l.roomId === r.id)
        .map((l) => ({ name: l.name, qty: `${fmtNum(l.quantity)} ${UNIT_LABEL[l.unit] ?? l.unit}` })),
    }))
    .filter((r) => r.lines.length > 0);
  const days = q.result.schedule.totalDays;
  return {
    companyName: db.company?.name ?? "",
    companyWhatsapp: db.company?.whatsapp ?? "",
    companyCity: db.company?.city ?? "",
    number: q.number,
    date: fmtDate(q.revisedAt ?? q.createdAt),
    validUntil: fmtDate(q.validUntil),
    clientName: client?.name ?? "",
    siteAddress: q.siteAddress,
    rooms,
    materialNames: q.result.materialLines.filter((m) => m.included).map((m) => m.name),
    total: formatBRL(q.result.totals.totalCents),
    days: days > 0 ? `${days} dia${days > 1 ? "s" : ""} (com dias de segurança)` : "a combinar",
    paymentTerms: q.paymentTerms,
    notes: q.notes,
  };
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Gera o PDF e abre o compartilhamento do celular; se não houver, baixa o PDF e abre o WhatsApp. */
export async function sharePdfOnWhatsApp(db: Db, q: Quote): Promise<"shared" | "downloaded"> {
  const { renderQuotePdf } = await import("@/integrations/pdf/quotePdf");
  const data = buildPdfData(db, q);
  const blob = await renderQuotePdf(data);
  const file = new File([blob], `orcamento-${q.number}.pdf`, { type: "application/pdf" });
  const text = `Olá ${data.clientName}! Segue o orçamento nº ${q.number} — ${data.total}. Validade: ${data.validUntil}.`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: `Orçamento ${q.number}` });
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
  const { renderQuotePdf } = await import("@/integrations/pdf/quotePdf");
  const blob = await renderQuotePdf(buildPdfData(db, q));
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
