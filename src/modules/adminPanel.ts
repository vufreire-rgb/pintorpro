import { adminStatsOnServer } from "@/repositories/cloudStore";

export interface AdminContact { id: string; name: string; email: string; phone: string; daysSince: number; quotes: number }
export interface AdminPeriod {
  novasContas: number; orcamentos: number; valorOrcadoCents: number; fechados: number; valorFechadoCents: number;
  taxaFechamentoPct: number | null; voz: number; recibos: number; custoIaCents: number;
}
export interface AdminSettings { goalSubscribers: number; goalDate: string | null; taxPct: number; fixedCostCents: number; voiceCostCents: number; receiptCostCents: number }
export interface AdminExpense { id: string; day: string; description: string; amountCents: number }
export interface AdminStats {
  periodo: "7d" | "mes";
  meta: { alvo: number; data: string | null; atual: number; faltam: number; ritmoPorSemana: number | null };
  assinantes: { pagantes: number; emTeste: number; testeVencido: number; atrasados: number; cancelados: number; deltaEmTeste: string | null };
  atual: AdminPeriod; anterior: AdminPeriod;
  deltas: { orcamentos: string | null; novasContas: string | null; valorOrcado: string | null; taxaFechamento: string | null; custoIa: string | null };
  ativas7d: number; sumidas: AdminContact[]; fimDoTeste: AdminContact[];
  funil: { contas: number; primeiraVisita: number; primeiroOrcamento: number; orcamentoEnviado: number; orcamentoFechado: number };
  serieNovasContas: number[];
  dinheiro: { ligado: boolean; faturamentoCents: number | null; impostoCents: number | null; custoIaCents: number; fixosCents: number; gastosCents: number; lucroCents: number | null };
  gastos: AdminExpense[];
  ajustes: AdminSettings;
}

/** Busca os números do painel. Com `settings`, grava os ajustes antes de calcular. */
export async function loadAdminStats(period: "7d" | "mes", settings?: AdminSettings, extra?: { addExpense?: { description: string; amountCents: number; day: string }; deleteExpense?: string }): Promise<AdminStats> {
  return (await adminStatsOnServer({ period, settings, ...extra })) as AdminStats;
}

/** Só os dígitos do telefone, com o 55 do Brasil na frente, para o link do WhatsApp. */
export function whatsappDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length >= 12 ? d : "55" + d;
}

/** Cor de cada variação: crescer é bom, exceto no custo. */
export function deltaTone(text: string | null, goodWhenUp = true): "up" | "down" | "flat" {
  if (!text || text === "igual") return "flat";
  const up = text.startsWith("+");
  return up === goodWhenUp ? "up" : "down";
}
