import { sendDictation } from "@/repositories/cloudStore";

/** Passa disso o áudio fica grande: o ditado para sozinho. */
export const MAX_DICTATION_SECONDS = 90;

const FAILURE_TEXT: Record<string, string> = {
  not_configured: "O ditado ainda não está ligado nesta conta. Avise o suporte.",
  daily_limit: "Você chegou ao limite de ditados de hoje. Digite este texto ou volte amanhã.",
  too_big: "O áudio ficou longo demais. Fale um trecho menor e tente de novo.",
  ai_failed: "Não consegui entender o áudio agora. Tente de novo.",
  unauthorized: "Sua sessão expirou. Entre de novo no app e tente outra vez.",
  network: "Sem internet. O ditado precisa de conexão. Digite o texto ou tente de novo quando estiver online.",
};
export const dictationFailureText = (code: string): string => FAILURE_TEXT[code] ?? FAILURE_TEXT.ai_failed!;

/** Envia o áudio e devolve o texto (vazio se não entendeu nada). Falha com o código do problema. */
export async function transcribeDictation(audio: Blob): Promise<string> {
  const r = (await sendDictation(audio)) as { transcript?: string };
  return String(r?.transcript ?? "").trim();
}

/** Junta o que foi ditado ao texto que já estava no campo, sem apagar nada. */
export function appendDictation(current: string, said: string): string {
  const t = said.trim();
  if (!t) return current;
  const base = current.replace(/\s+$/, "");
  return base ? `${base}${/[.!?:;]$/.test(base) ? " " : ". "}${t.charAt(0).toUpperCase()}${t.slice(1)}` : `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}
