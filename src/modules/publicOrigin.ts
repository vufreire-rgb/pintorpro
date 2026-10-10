/** Endereço público oficial dos links (página do pintor e orçamento). Em testes locais usa o endereço aberto; em produção sempre o domínio do Medde (curto e bonito para compartilhar). */
export const PUBLIC_ORIGIN = "https://medde.com.br";

export function publicOrigin(): string {
  const local = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return local ? window.location.origin : PUBLIC_ORIGIN;
}
