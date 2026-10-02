import { tintOf } from "./pdfData";

/** Escurece a cor misturando com preto (ex.: 0.25 = 25% de preto). */
export function darken(hex: string, amount = 0.25): string {
  const h = hex.replace("#", "");
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, "0")).join("");
}

/** Tons do app a partir da cor escolhida pelo pintor (mesmos nomes do @theme em globals.css). */
export const themeVars = (hex: string): Record<string, string> => ({
  "--color-brand": hex,
  "--color-brand-dark": darken(hex),
  "--color-brand-soft": tintOf(hex, 0.1).toLowerCase(),
});
