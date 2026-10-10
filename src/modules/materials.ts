import { fmtNum } from "@/shared/format";
import { materialLines } from "./pdfData";
import type { Quote } from "./types";

/** Itens para comprar: o que o pintor anotou + as quantidades calculadas (só dos materiais que ele vai comprar). */
export function materialsForShopping(q: Pick<Quote, "materialsText" | "result">): { written: string[]; calculated: string[] } {
  return {
    written: materialLines(q.materialsText),
    calculated: q.result.materialLines.filter((m) => m.included && m.purchaseQty > 0).map((m) => `${m.name}: ${fmtNum(m.purchaseQty)} ${m.unit}`),
  };
}

/** Mensagem pronta para mandar à loja de tintas (ou ao cliente): quem é, onde é a obra e a lista. "" se não há nada para listar. */
export function materialsMessage(opts: { company: string; clientName: string; address: string; written: string[]; calculated: string[] }): string {
  const { written, calculated } = opts;
  if (!written.length && !calculated.length) return "";
  const lines = [`Lista de materiais${opts.clientName ? ` — obra de ${opts.clientName}` : ""}${opts.company ? ` (${opts.company})` : ""}`];
  if (opts.address) lines.push(`Endereço: ${opts.address}`);
  lines.push("");
  if (written.length) lines.push(...written.map((l) => `• ${l}`));
  if (calculated.length) {
    if (written.length) lines.push("");
    lines.push("Quantidades calculadas:", ...calculated.map((l) => `• ${l}`));
  }
  return lines.join("\n");
}
