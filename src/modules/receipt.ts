import { sendReceipt } from "@/repositories/cloudStore";
import type { ExpenseKind } from "./types";

/** O que a IA leu do recibo. Espelha supabase/functions/receipt-scan/logic.ts. */
export interface ReceiptDraft {
  amountReais: number;
  /** AAAA-MM-DD ou "". */
  date: string;
  store: string;
  kind: ExpenseKind;
  description: string;
}

const FAILURE_TEXT: Record<string, string> = {
  not_configured: "A leitura de recibo por foto ainda não está ligada. Digite o gasto.",
  daily_limit: "Você chegou ao limite de recibos por foto de hoje. Digite o gasto ou volte amanhã.",
  too_big: "A foto ficou grande demais. Tire outra, mais perto do recibo.",
  ai_failed: "Não consegui ler o recibo agora. Tente de novo ou digite o gasto.",
  unauthorized: "Sua sessão expirou. Entre de novo no app e tente outra vez.",
  network: "Sem internet. A leitura do recibo precisa de conexão. Digite o gasto ou tente de novo online.",
};
export const receiptFailureText = (code: string): string => FAILURE_TEXT[code] ?? FAILURE_TEXT.ai_failed!;

const MAX_SIDE = 1600;

/** Reduz a foto (lado maior de 1600 px, JPEG) para a leitura ser rápida e barata. Se não conseguir, manda a original. */
export async function shrinkImage(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return out ?? file;
  } catch {
    return file;
  }
}

/** Fotografa → reduz → lê. Falha com o código do problema (ver receiptFailureText). */
export async function readReceipt(photo: Blob): Promise<ReceiptDraft> {
  const small = await shrinkImage(photo);
  const { draft } = (await sendReceipt(small)) as { draft: ReceiptDraft };
  return draft;
}
