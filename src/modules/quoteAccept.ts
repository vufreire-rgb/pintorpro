import { acceptQuoteLink } from "@/repositories/cloudStore";
import { formatBRL } from "@/shared/money";
import type { SharedQuote } from "./quoteLinks";

/** Soma dos ambientes marcados, em centavos. null se algum ambiente não tem valor (aí não dá para somar). */
export function selectedCents(rooms: SharedQuote["rooms"], selected: ReadonlySet<number>): number | null {
  let sum = 0;
  for (const i of selected) {
    const c = rooms[i]?.priceCents;
    if (typeof c !== "number") return null;
    sum += c;
  }
  return sum;
}

export interface CloseChoice { all: boolean; names: string[]; totalLabel: string }

/** O que o cliente escolheu: todos os ambientes ou só alguns, e o total correspondente. */
export function closeChoice(q: Pick<SharedQuote, "rooms" | "total">, selected: ReadonlySet<number>): CloseChoice {
  const n = q.rooms.length;
  const idx = [...selected].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
  const all = n === 0 || idx.length === n;
  if (all) return { all: true, names: q.rooms.map((r) => r.name), totalLabel: q.total };
  const cents = selectedCents(q.rooms, new Set(idx));
  return { all: false, names: idx.map((i) => q.rooms[i]!.name), totalLabel: cents === null ? "" : formatBRL(cents) };
}

/** Mensagem pronta para o WhatsApp do pintor. */
export function closeMessage(q: Pick<SharedQuote, "number" | "painter" | "rooms">, c: CloseChoice): string {
  const lines = [`Olá! Quero fechar o orçamento nº ${q.number} (${q.painter.company}).`];
  if (q.rooms.length > 0) lines.push(c.all ? "Ambientes: todos." : `Ambientes escolhidos (${c.names.length} de ${q.rooms.length}): ${c.names.join(", ")}.`);
  if (c.all) lines.push(`Total: ${c.totalLabel}.`);
  else if (c.totalLabel) lines.push(`Total dos ambientes escolhidos: ${c.totalLabel}.`);
  lines.push("Podemos combinar a data de início?");
  return lines.join("\n");
}

/** Avisa o pintor (notificação e registro no app). Posições dos ambientes marcados, na ordem do orçamento. */
export const notifyClose = (token: string, selected: ReadonlySet<number>): Promise<void> => acceptQuoteLink(token, [...selected].sort((a, b) => a - b));
