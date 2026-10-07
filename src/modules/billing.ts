import { fmtDate, plural } from "@/shared/format";

/**
 * Regras da assinatura (sem depender de gateway). Quem decide quem está ativo é o servidor (tabela `subscriptions`);
 * aqui só se calcula, a partir das datas, o que mostrar: tudo certo, aviso antes de vencer, aviso depois de vencer ou bloqueio.
 *
 *   ok        faltam mais de 3 dias para vencer
 *   ending    faltam 3 dias ou menos para vencer
 *   grace     venceu há menos de 3 dias (o acesso ainda funciona, com aviso de bloqueio)
 *   blocked   venceu há 3 dias ou mais
 */
export type SubStatus = "trial" | "active" | "canceled";

export interface Subscription {
  status: SubStatus;
  /** ISO. Fim do teste grátis. */
  trialEndsAt: string;
  /** ISO. Fim do período pago; null = sem data de fim (acesso liberado manualmente). */
  periodEnd: string | null;
}

export const WARN_DAYS = 3;
export const GRACE_DAYS = 3;
/** Preço mostrado ao cliente (texto). Troque aqui quando o valor for definido de vez. */
export const PRICE_LABEL = "R$ 29,90 por mês";

export type AccessLevel = "ok" | "ending" | "grace" | "blocked";

export interface Access {
  level: AccessLevel;
  kind: "trial" | "paid";
  /** Fim do período atual (null = sem fim). */
  endsAt: Date | null;
  /** Dias inteiros até vencer (arredondado para cima; 0 ou negativo = já venceu). */
  daysToEnd: number;
  /** Dias inteiros até o bloqueio (só faz sentido em "grace"). */
  daysToBlock: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function accessOf(sub: Subscription, now: Date = new Date()): Access {
  const kind = sub.status === "trial" ? "trial" : "paid";
  const raw = sub.status === "trial" ? sub.trialEndsAt : sub.periodEnd;
  const endsAt = raw ? new Date(raw) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) return { level: "ok", kind, endsAt: null, daysToEnd: Infinity, daysToBlock: Infinity };

  const left = endsAt.getTime() - now.getTime();
  const daysToEnd = Math.ceil(left / DAY);
  if (left > WARN_DAYS * DAY) return { level: "ok", kind, endsAt, daysToEnd, daysToBlock: Infinity };
  if (left > 0) return { level: "ending", kind, endsAt, daysToEnd, daysToBlock: Infinity };
  const over = -left;
  if (over >= GRACE_DAYS * DAY) return { level: "blocked", kind, endsAt, daysToEnd, daysToBlock: 0 };
  return { level: "grace", kind, endsAt, daysToEnd, daysToBlock: Math.ceil((GRACE_DAYS * DAY - over) / DAY) };
}

/** Texto curto para o aviso. `null` quando não há o que avisar. */
export function accessMessage(a: Access): { title: string; text: string } | null {
  const trial = a.kind === "trial";
  if (a.level === "ending") {
    const when = a.daysToEnd <= 1 ? "termina hoje ou amanhã" : `termina em ${plural(a.daysToEnd, "dia", "dias")}`;
    return trial
      ? { title: `Seu teste grátis ${when}`, text: `Para continuar usando o Medde, assine por ${PRICE_LABEL}.` }
      : { title: `Sua assinatura vence${a.daysToEnd <= 1 ? " hoje ou amanhã" : ` em ${plural(a.daysToEnd, "dia", "dias")}`}`, text: "Confira o pagamento para não perder o acesso." };
  }
  if (a.level === "grace") {
    return {
      title: trial ? "Seu teste grátis terminou" : "Pagamento pendente",
      text: `O acesso será bloqueado em ${plural(a.daysToBlock, "dia", "dias")}. Seus dados continuam guardados.`,
    };
  }
  if (a.level === "blocked") {
    return { title: "Acesso bloqueado", text: trial ? "Seu teste grátis terminou." : "O pagamento não foi identificado." };
  }
  return null;
}

/** "Teste grátis até 12/11/2026" ou "Assinatura ativa até 12/11/2026" (para a tela de Ajustes). */
export function statusLine(sub: Subscription): string {
  if (sub.status === "trial") return `Teste grátis até ${fmtDate(sub.trialEndsAt)}`;
  const base = sub.status === "canceled" ? "Assinatura cancelada" : "Assinatura ativa";
  return sub.periodEnd ? `${base} até ${fmtDate(sub.periodEnd)}` : base;
}
