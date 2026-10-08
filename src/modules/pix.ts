/** Pix "copia e cola" estático (BR Code, padrão do Banco Central). Não passa dinheiro pelo app: só monta o código para o pintor receber na própria conta. */

export type PixKeyType = "doc" | "phone" | "email" | "random";

export interface PixConfig {
  type: PixKeyType;
  /** Como o pintor digitou (CPF/CNPJ, celular, e-mail ou chave aleatória). */
  key: string;
  /** Nome do recebedor (até 25 letras, sem acento). Vazio = nome do negócio. */
  name?: string;
  /** Cidade (até 15 letras). Vazio = cidade do negócio. */
  city?: string;
}

export const PIX_TYPE_LABEL: Record<PixKeyType, string> = {
  doc: "CPF ou CNPJ",
  phone: "Celular",
  email: "E-mail",
  random: "Chave aleatória",
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Tipo da chave pelo jeito que foi digitada, para a pessoa não ter que escolher.
 * "ask": 11 números soltos podem ser CPF ou celular; o app NÃO adivinha (errar mandaria o Pix para a chave errada).
 * null: ainda não dá para saber (vazio, incompleto ou estranho).
 */
export function guessPixType(raw: string): PixKeyType | "ask" | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) return "email";
  if (UUID_RE.test(v)) return "random";
  const d = v.replace(/\D/g, "");
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(v)) return "doc";
  if (d.length === 14) return "doc";
  const phoneLike = v.startsWith("+") || v.startsWith("(");
  if (d.length === 10 || ((d.length === 12 || d.length === 13) && d.startsWith("55"))) return "phone";
  if (d.length === 11) return phoneLike ? "phone" : "ask";
  return null;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), em 4 letras maiúsculas. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Chave no formato que o Pix espera. Devolve "" se a chave não parece válida. */
export function normalizePixKey(type: PixKeyType, raw: string): string {
  const v = raw.trim();
  if (type === "doc") {
    const d = v.replace(/\D/g, "");
    return d.length === 11 || d.length === 14 ? d : "";
  }
  if (type === "phone") {
    const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    return d.length === 10 || d.length === 11 ? `+55${d}` : "";
  }
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : "";
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v) ? v.toLowerCase() : "";
}

/** Tira acento e símbolos, deixa só letras/números/espaço, em maiúsculas (o Pix exige texto simples). */
export function pixText(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/**
 * Monta o código "copia e cola". `amountCents` opcional: com valor, o app do banco já abre com ele preenchido.
 * Devolve "" se a chave ou o nome forem inválidos.
 */
export function pixPayload(cfg: PixConfig, fallback: { name: string; city: string }, amountCents?: number): string {
  const key = normalizePixKey(cfg.type, cfg.key);
  const name = pixText(cfg.name || fallback.name, 25);
  const city = pixText(cfg.city || fallback.city, 15) || "BRASIL";
  if (!key || !name) return "";
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const amount = amountCents && amountCents > 0 ? tlv("54", (amountCents / 100).toFixed(2)) : "";
  const body =
    tlv("00", "01") + // versão
    tlv("01", "11") + // 11 = estático (reutilizável)
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") + // real
    amount +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", tlv("05", "***")) +
    "6304";
  return body + crc16(body);
}
