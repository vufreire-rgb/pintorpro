// Lógica pura da função "receipt-scan": prompt da IA e limpeza do que ela devolve. Sem rede, fácil de testar.

export const KINDS = ["material", "ajudante", "transporte", "outro"] as const;

export interface ReceiptDraft {
  /** Total pago, em reais; 0 = não encontrado. */
  amountReais: number;
  /** AAAA-MM-DD; "" = não encontrada. */
  date: string;
  store: string;
  kind: (typeof KINDS)[number];
  /** Itens comprados, resumidos. */
  description: string;
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const DAILY_LIMIT = 60;

export const SYSTEM_PROMPT = `Você lê a foto de um recibo, nota fiscal ou cupom de uma compra feita por um pintor de obras no Brasil.
Regras:
- Use SOMENTE o que está legível na imagem. Se não der para ler, devolva "" (texto) ou 0 (número). Nunca invente valor, data ou loja.
- amountReais: o TOTAL pago (o valor final da compra), em reais. Use ponto decimal (ex.: 1234.50).
- date: a data da compra no formato AAAA-MM-DD, ou "" se não houver.
- store: nome da loja ou do prestador.
- kind: material (tintas, massas, lixas, pincéis, ferramentas), ajudante (pagamento de mão de obra), transporte (combustível, frete, pedágio) ou outro.
- description: os principais itens, curto (máximo 100 caracteres).
Responda só com o JSON pedido.`;

const num = (v: unknown, max: number): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Data válida AAAA-MM-DD, não no futuro e de no máximo ~2 anos atrás; senão "". */
export function cleanDate(v: unknown, today = new Date()): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(v + "T12:00:00");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return "";
  const t = today.getTime();
  return d.getTime() > t + 86400000 || d.getTime() < t - 730 * 86400000 ? "" : v;
}

export function normalizeReceipt(raw: unknown, today = new Date()): ReceiptDraft {
  let o: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
  } catch {
    /* resposta quebrada: rascunho vazio, o app pede para o pintor digitar */
  }
  return {
    amountReais: Math.round(num(o.amountReais, 1_000_000) * 100) / 100,
    date: cleanDate(o.date, today),
    store: str(o.store, 80),
    kind: (KINDS as readonly string[]).includes(o.kind as string) ? (o.kind as ReceiptDraft["kind"]) : "material",
    description: str(o.description, 100),
  };
}

export const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["amountReais", "date", "store", "kind", "description"],
  properties: {
    amountReais: { type: "number" },
    date: { type: "string" },
    store: { type: "string" },
    kind: { type: "string", enum: [...KINDS] },
    description: { type: "string" },
  },
} as const;
