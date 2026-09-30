/** Dinheiro sempre em centavos inteiros (sem float). */
export type Cents = number;

export const toCents = (reais: number): Cents => Math.round(reais * 100);

export const formatBRL = (cents: Cents): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
