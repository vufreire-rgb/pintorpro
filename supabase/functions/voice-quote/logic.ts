// Lógica pura da função "voice-quote": prompt da IA e limpeza do que ela devolve. Sem rede, fácil de testar.

export const PAINTS = ["acrilica", "esmalte", "piso", "grafiato", "cimento_queimado"] as const;
export const CONDITIONS = ["nova", "pintada", "descascando", "trincas"] as const;

export interface VoiceRoom {
  name: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  /** Só a área total de parede, quando o pintor não falou as medidas do cômodo. */
  wallAreaM2: number;
  includeCeiling: boolean;
  paint: (typeof PAINTS)[number];
  condition: (typeof CONDITIONS)[number];
  doors: number;
  windows: number;
}

export interface VoiceDraft {
  clientName: string;
  phone: string;
  address: string;
  rooms: VoiceRoom[];
  /** Preço fechado em reais; 0 = o pintor não falou preço. */
  closedPriceReais: number;
  paymentTerms: string;
  notes: string;
}

export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
export const DAILY_LIMIT = 40;
/** Ditado de texto (só transcrever): bem mais barato que o orçamento por voz, por isso o limite é maior. */
export const DICTATION_DAILY_LIMIT = 150;
/** Ditado de um campo de texto: áudio curto. */
export const MAX_DICTATION_BYTES = 3 * 1024 * 1024;

export const SYSTEM_PROMPT = `Você ajuda um pintor de obras brasileiro. Ele ditou um orçamento falando. Extraia os dados do texto transcrito.
Regras:
- Use SOMENTE o que foi dito. Se algo não foi dito, devolva "" (texto) ou 0 (número). Nunca invente nome, telefone, medida ou preço.
- Medidas em metros. "quatro por cinco" = comprimento 4 e largura 5. "pé direito 2,70" = altura 2.7. Se a altura não foi dita, use 0.
- Se o pintor falou só a área de parede de um cômodo (ex.: "40 metros de parede"), use wallAreaM2 e deixe comprimento e largura 0.
- includeCeiling é true só se ele falou em pintar o teto.
- paint: acrilica (padrão), esmalte, piso, grafiato ou cimento_queimado.
- condition (estado das paredes): nova, pintada (padrão), descascando ou trincas.
- closedPriceReais: o valor total que ele fechou, em reais (ex.: "dois mil e oitocentos" = 2800). 0 se não falou.
- paymentTerms: forma de pagamento falada (ex.: "50% de entrada e o resto no fim"). "" se não falou.
- notes: pedidos ou detalhes importantes que não cabem nos outros campos. Curto.
Responda só com o JSON pedido.`;

const num = (v: unknown, max: number): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const count = (v: unknown): number => Math.min(20, Math.round(num(v, 20)));

/** Aceita o que a IA devolveu (texto JSON ou objeto) e devolve um rascunho seguro: tipos certos e números dentro de limites. */
export function normalizeDraft(raw: unknown): VoiceDraft {
  let o: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
  } catch {
    /* resposta quebrada: rascunho vazio, o app pede para tentar de novo */
  }
  const rooms = (Array.isArray(o.rooms) ? o.rooms : []).slice(0, 20).map((r): VoiceRoom => {
    const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    return {
      name: str(x.name, 60),
      lengthM: num(x.lengthM, 50),
      widthM: num(x.widthM, 50),
      heightM: num(x.heightM, 10),
      wallAreaM2: num(x.wallAreaM2, 5000),
      includeCeiling: x.includeCeiling === true,
      paint: oneOf(x.paint, PAINTS, "acrilica"),
      condition: oneOf(x.condition, CONDITIONS, "pintada"),
      doors: count(x.doors),
      windows: count(x.windows),
    };
  });
  return {
    clientName: str(o.clientName, 80),
    phone: str(o.phone, 30),
    address: str(o.address, 200),
    rooms,
    closedPriceReais: Math.round(num(o.closedPriceReais, 1_000_000) * 100) / 100,
    paymentTerms: str(o.paymentTerms, 200),
    notes: str(o.notes, 500),
  };
}

/** Formato (JSON Schema) que a IA é obrigada a seguir. */
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clientName", "phone", "address", "rooms", "closedPriceReais", "paymentTerms", "notes"],
  properties: {
    clientName: { type: "string" },
    phone: { type: "string" },
    address: { type: "string" },
    closedPriceReais: { type: "number" },
    paymentTerms: { type: "string" },
    notes: { type: "string" },
    rooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "lengthM", "widthM", "heightM", "wallAreaM2", "includeCeiling", "paint", "condition", "doors", "windows"],
        properties: {
          name: { type: "string" },
          lengthM: { type: "number" },
          widthM: { type: "number" },
          heightM: { type: "number" },
          wallAreaM2: { type: "number" },
          includeCeiling: { type: "boolean" },
          paint: { type: "string", enum: [...PAINTS] },
          condition: { type: "string", enum: [...CONDITIONS] },
          doors: { type: "number" },
          windows: { type: "number" },
        },
      },
    },
  },
} as const;

/**
 * Quando o áudio é silêncio ou barulho, o serviço de transcrição pode devolver o próprio texto de dica que enviamos.
 * Se a transcrição for (quase) só isso, tratamos como "não entendi nada".
 */
export function echoesHint(transcript: string, hint: string): boolean {
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(transcript), h = norm(hint);
  if (!t) return false;
  if (h.includes(t) && t.length > 12) return true;
  const hw = new Set(h.split(" "));
  const tw = t.split(" ");
  return tw.length >= 6 && tw.filter((w) => hw.has(w)).length / tw.length >= 0.8;
}
