import { formatBRL } from "@/shared/money";
import { valorPorExtenso } from "./finance";
import { initialsOf, padNumber, tintOf } from "./pdfData";
import { dateBR } from "./workInfo";
import type { Db, Payment, PaymentMethod, Work } from "./types";

export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", transferencia: "Transferência", outro: "Outro" };

/** Tudo que o recibo mostra. */
export interface ReceiptPdfData {
  color: string;
  tint: string;
  logo?: string;
  company: { name: string; initials: string; owner: string; city: string; whatsapp: string };
  number: string;
  date: string;
  clientName: string;
  siteAddress: string;
  amount: string;
  amountWords: string;
  note: string;
  method: string;
  summary: { agreed: string; received: string; remaining: string };
}

export function buildReceiptData(db: Db, w: Work, payment: Payment): ReceiptPdfData {
  const c = db.company;
  const q = db.quotes.find((x) => x.id === w.quoteId);
  const client = db.clients.find((x) => x.id === w.clientId);
  const list = w.payments ?? [];
  const idx = Math.max(0, list.findIndex((p) => p.id === payment.id));
  const until = list.slice(0, idx + 1).reduce((s, p) => s + p.amountCents, 0);
  const color = c?.brandColor ?? "#0F3B7A";
  return {
    color,
    tint: tintOf(color),
    company: { name: c?.name ?? "", initials: initialsOf(c?.name ?? ""), owner: c?.ownerName ?? "", city: c?.city ?? "", whatsapp: c?.whatsapp ?? "" },
    number: `${q ? padNumber(q.number) : "0000"}-${String(idx + 1).padStart(2, "0")}`,
    date: dateBR(payment.date),
    clientName: client?.name ?? "",
    siteAddress: q?.siteAddress ?? "",
    amount: formatBRL(payment.amountCents),
    amountWords: valorPorExtenso(payment.amountCents),
    note: payment.note || "pagamento",
    method: payment.method ? METHOD_LABEL[payment.method] : "",
    summary: { agreed: formatBRL(w.plannedTotalCents), received: formatBRL(until), remaining: formatBRL(Math.max(0, w.plannedTotalCents - until)) },
  };
}
