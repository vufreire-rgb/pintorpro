import { formatBRL } from "@/shared/money";
import { valorPorExtenso, type InstallmentView } from "./finance";
import { initialsOf, padNumber, tintOf } from "./pdfData";
import { normalizePixKey, pixPayload, pixText } from "./pix";
import { dateBR } from "./workInfo";
import type { Db, Work } from "./types";

/** Tudo que o PDF de cobrança mostra. */
export interface ChargePdfData {
  color: string;
  tint: string;
  logo?: string;
  company: { name: string; initials: string; owner: string; city: string; whatsapp: string };
  number: string;
  clientName: string;
  siteAddress: string;
  label: string;
  dueDate: string;
  /** "Atrasada", "Vence em breve"… */
  status: string;
  late: boolean;
  amount: string;
  amountWords: string;
  summary: { agreed: string; received: string; remaining: string };
  /** QR do Pix para o valor em aberto (se o pintor cadastrou a chave). */
  pix?: { qr: string; code: string; receiver: string };
}

const STATUS: Record<InstallmentView["state"], string> = { paid: "Paga", partial: "Paga em parte", late: "Atrasada", due_soon: "Vence em breve", open: "Em aberto" };

/** `qr` é gerado por quem chama (precisa de imagem). Devolve também o código copia e cola. */
export function buildChargeData(db: Db, w: Work, p: InstallmentView, pix?: { qr: string; code: string }): ChargePdfData {
  const c = db.company;
  const q = db.quotes.find((x) => x.id === w.quoteId);
  const client = db.clients.find((x) => x.id === w.clientId);
  const color = c?.brandColor ?? "#0F3B7A";
  const open = p.amountCents - p.coveredCents;
  const received = (w.payments ?? []).reduce((s, x) => s + x.amountCents, 0);
  return {
    color,
    tint: tintOf(color),
    company: { name: c?.name ?? "", initials: initialsOf(c?.name ?? ""), owner: c?.ownerName ?? "", city: c?.city ?? "", whatsapp: c?.whatsapp ?? "" },
    number: q ? padNumber(q.number) : "0000",
    clientName: client?.name ?? "",
    siteAddress: q?.siteAddress ?? "",
    label: p.label,
    dueDate: dateBR(p.dueDate),
    status: STATUS[p.state],
    late: p.state === "late",
    amount: formatBRL(open),
    amountWords: valorPorExtenso(open),
    summary: { agreed: formatBRL(w.plannedTotalCents), received: formatBRL(received), remaining: formatBRL(Math.max(0, w.plannedTotalCents - received)) },
    pix: pix && c?.pix ? { ...pix, receiver: pixText(c.pix.name || c.name, 25) } : undefined,
  };
}

/** Código Pix do valor em aberto desta parcela ("" se o pintor ainda não cadastrou a chave). */
export function pixCodeFor(db: Db, cents: number): string {
  const px = db.company?.pix;
  if (!px || !db.company || !normalizePixKey(px.type, px.key)) return "";
  return pixPayload(px, { name: db.company.name, city: db.company.city }, cents);
}
