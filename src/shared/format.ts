export const parseNum = (s: string): number => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const fmtNum = (n: number, digits = 2): string =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);

export const UNIT_LABEL: Record<string, string> = { m2: "m²", ml: "m", un: "un", diaria: "diária", fechado: "fechado" };

export const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString("pt-BR");

/** "1 porta" / "2 portas" — sem "(s)". */
export const plural = (n: number, one: string, many: string): string => `${fmtNum(n)} ${n === 1 ? one : many}`;
