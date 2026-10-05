import { formatBRL } from "@/shared/money";
import { addDays, paidCents, ymd } from "./workInfo";
import type { Installment, Work } from "./types";

/** Plano de pagamento da obra: parcelas, situação de cada uma, mensagem de cobrança e valor por extenso. Funções puras. */

export type PlanPreset = "avista" | "entrada_final" | "entrada_2" | "entrada_3";

export const PLAN_PRESET_LABEL: Record<PlanPreset, string> = {
  avista: "À vista",
  entrada_final: "Entrada + saldo no fim",
  entrada_2: "Entrada + 2 parcelas",
  entrada_3: "Entrada + 3 parcelas",
};

/**
 * Monta as parcelas a partir do valor combinado. A entrada vence no início da obra (ou hoje);
 * as demais, de 15 em 15 dias (a última no término, se houver). O resto da divisão vai na última parcela.
 */
export function buildPlan(preset: PlanPreset, total: number, depositPct: number, start: string, end?: string): Installment[] {
  const mk = (label: string, dueDate: string, amountCents: number): Installment => ({ id: crypto.randomUUID(), label, dueDate, amountCents });
  if (preset === "avista") return [mk("Pagamento único", start, total)];
  const entry = Math.round((total * Math.min(100, Math.max(1, depositPct))) / 100);
  const rest = total - entry;
  if (preset === "entrada_final" || rest <= 0) return [mk("Entrada", start, entry), ...(rest > 0 ? [mk("Saldo", end && end > start ? end : addDays(start, 15), rest)] : [])];
  const n = preset === "entrada_2" ? 2 : 3;
  const each = Math.floor(rest / n);
  const out = [mk("Entrada", start, entry)];
  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const due = isLast && end && end > addDays(start, 15 * (n - 1)) ? end : addDays(start, 15 * i);
    out.push(mk(`Parcela ${i}`, due, isLast ? rest - each * (n - 1) : each));
  }
  return out;
}

export type InstallmentState = "paid" | "partial" | "late" | "due_soon" | "open";
export interface InstallmentView extends Installment {
  /** Quanto desta parcela já foi coberto pelos pagamentos. */
  coveredCents: number;
  state: InstallmentState;
}

/** Os pagamentos cobrem as parcelas em ordem (da mais antiga para a mais nova). */
export function planView(w: Work, today = ymd(new Date())): InstallmentView[] {
  let pool = paidCents(w);
  const sorted = [...(w.plan ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return sorted.map((p) => {
    const covered = Math.min(pool, p.amountCents);
    pool -= covered;
    let state: InstallmentState;
    if (covered >= p.amountCents) state = "paid";
    else if (p.dueDate < today) state = "late";
    else if (covered > 0) state = "partial";
    else if (p.dueDate <= addDays(today, 3)) state = "due_soon";
    else state = "open";
    return { ...p, coveredCents: covered, state };
  });
}

/** Parcelas vencidas e ainda não pagas (inclui parcial vencida). */
export const lateInstallments = (w: Work, today = ymd(new Date())): InstallmentView[] => planView(w, today).filter((p) => p.state === "late");
export const lateCents = (w: Work, today = ymd(new Date())): number => lateInstallments(w, today).reduce((s, p) => s + (p.amountCents - p.coveredCents), 0);

/** A soma das parcelas bate com o valor combinado? Devolve a diferença (positiva = faltam parcelas). */
export const planGapCents = (w: Work): number => w.plannedTotalCents - (w.plan ?? []).reduce((s, p) => s + p.amountCents, 0);

const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** Mensagem pronta de cobrança educada para o WhatsApp. */
export function chargeMessage(p: InstallmentView, client: string, company: string, pixCode?: string, now = ymd(new Date())): string {
  const first = client.trim().split(/\s+/)[0] ?? "";
  const open = p.amountCents - p.coveredCents;
  const label = p.label.toLowerCase();
  const when = p.dueDate < now ? `venceu em ${br(p.dueDate)}` : p.dueDate === now ? "vence hoje" : `vence em ${br(p.dueDate)}`;
  return [
    `Olá${first ? `, ${first}` : ""}! Tudo bem?`,
    `Passando para lembrar do pagamento (${label}) de ${formatBRL(open)}, que ${when}.`,
    pixCode ? `Pix copia e cola:\n${pixCode}` : "",
    "Qualquer dúvida é só me chamar. Obrigado!",
    company ? `— ${company}` : "",
  ].filter(Boolean).join("\n\n");
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CENTENAS[c]!);
  if (r) parts.push(r < 20 ? UNIDADES[r]! : DEZENAS[Math.floor(r / 10)]! + (r % 10 ? " e " + UNIDADES[r % 10] : ""));
  return parts.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000), mil = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  const parts: string[] = [];
  if (milhoes) parts.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (mil) parts.push(mil === 1 ? "mil" : `${ate999(mil)} mil`);
  if (resto) parts.push(ate999(resto));
  // "e" entre blocos só quando o último bloco é < 100 ou múltiplo exato de 100 (regra do português)
  if (parts.length <= 1) return parts[0]!;
  const last = resto || mil;
  const joiner = last < 100 || last % 100 === 0 ? " e " : ", ";
  return parts.slice(0, -1).join(", ") + joiner + parts[parts.length - 1];
}

/** 150050 -> "mil e quinhentos reais e cinquenta centavos". */
export function valorPorExtenso(cents: number): string {
  const reais = Math.floor(cents / 100), cent = cents % 100;
  const r = reais === 0 ? "" : `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : reais >= 1_000_000 && reais % 1_000_000 === 0 ? "de reais" : "reais"}`;
  const c = cent === 0 ? "" : `${inteiroPorExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`;
  if (r && c) return `${r} e ${c}`;
  return r || c || "zero real";
}
