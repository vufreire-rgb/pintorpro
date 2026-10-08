import type { Db } from "./types";

export interface FirstStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * Lista de "primeiros passos" até o pintor sentir o app funcionando. Itens de treino (exemplo) não contam.
 * Cada passo é concluído pelo uso de verdade, sem o pintor precisar marcar nada.
 */
export function firstSteps(db: Db): FirstStep[] {
  const visits = db.visits.filter((v) => !v.isExample);
  const quotes = db.quotes.filter((q) => !db.works.some((w) => w.isExample && w.quoteId === q.id));
  const works = db.works.filter((w) => !w.isExample);
  return [
    { id: "logo", label: "Colocar seu logo no orçamento", href: "/configuracoes", done: !!db.company?.logoId },
    { id: "pix", label: "Cadastrar sua chave Pix", href: "/configuracoes", done: !!db.company?.pix?.key },
    { id: "visita", label: "Registrar sua primeira visita", href: "/visitas/nova", done: visits.length > 0 },
    { id: "orcamento", label: "Fazer seu primeiro orçamento", href: "/orcamentos/novo", done: quotes.length > 0 },
    { id: "fechar", label: "Fechar um orçamento (vira obra)", href: "/orcamentos", done: quotes.some((q) => q.status === "won") },
    { id: "receber", label: "Lançar um pagamento recebido", href: "/obras", done: works.some((w) => (w.payments?.length ?? 0) > 0) },
  ];
}
