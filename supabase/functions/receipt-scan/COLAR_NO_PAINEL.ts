// Edge Function "receipt-scan": o pintor fotografa um recibo; devolve valor, data, loja e tipo para ele conferir.
// Usa o mesmo segredo OPENAI_API_KEY da função voice-quote. A foto NÃO é guardada: vai à OpenAI para ser lida e é descartada.
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- logic.ts (junto aqui para colar no painel) ----
// Lógica pura da função "receipt-scan": prompt da IA e limpeza do que ela devolve. Sem rede, fácil de testar.

const KINDS = ["material", "ajudante", "transporte", "outro"] as const;

interface ReceiptDraft {
  /** Total pago, em reais; 0 = não encontrado. */
  amountReais: number;
  /** AAAA-MM-DD; "" = não encontrada. */
  date: string;
  store: string;
  kind: (typeof KINDS)[number];
  /** Itens comprados, resumidos. */
  description: string;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DAILY_LIMIT = 60;

const SYSTEM_PROMPT = `Você lê a foto de um recibo, nota fiscal ou cupom de uma compra feita por um pintor de obras no Brasil.
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
function cleanDate(v: unknown, today = new Date()): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(v + "T12:00:00");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return "";
  const t = today.getTime();
  return d.getTime() > t + 86400000 || d.getTime() < t - 730 * 86400000 ? "" : v;
}

function normalizeReceipt(raw: unknown, today = new Date()): ReceiptDraft {
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

const RECEIPT_SCHEMA = {
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
// ---- fim de logic.ts ----

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];
const MODEL = "gpt-4o-mini";

const corsFor = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0]!,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const toBase64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "unauthorized" });
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply(503, { error: "not_configured" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply(401, { error: "unauthorized" });

  // Limite diário por pessoa (protege o custo). Se a tabela ainda não existir, segue sem limite e avisa no log.
  const day = new Date().toISOString().slice(0, 10);
  const used = await admin.from("receipt_usage").select("count").eq("user_id", data.user.id).eq("day", day).maybeSingle();
  if (used.error) console.error("receipt_usage indisponível", used.error.message);
  else if ((used.data?.count ?? 0) >= DAILY_LIMIT) return reply(429, { error: "daily_limit" });

  let image: File;
  try {
    const f = (await req.formData()).get("image");
    if (!(f instanceof File)) return reply(400, { error: "no_image" });
    image = f;
  } catch {
    return reply(400, { error: "bad_request" });
  }
  if (image.size === 0) return reply(400, { error: "no_image" });
  if (image.size > MAX_IMAGE_BYTES) return reply(413, { error: "too_big" });

  try {
    const b64 = toBase64(new Uint8Array(await image.arrayBuffer()));
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [{ type: "text", text: "Leia este recibo." }, { type: "image_url", image_url: { url: `data:${image.type || "image/jpeg"};base64,${b64}`, detail: "high" } }] },
        ],
        response_format: { type: "json_schema", json_schema: { name: "recibo", strict: true, schema: RECEIPT_SCHEMA } },
      }),
    });
    if (!r.ok) throw new Error(`vision ${r.status}`);
    const content = (await r.json()).choices?.[0]?.message?.content;
    if (!used.error) await admin.from("receipt_usage").upsert({ user_id: data.user.id, day, count: (used.data?.count ?? 0) + 1 });
    return reply(200, { draft: normalizeReceipt(content) });
  } catch (e) {
    console.error("receipt-scan failed", e instanceof Error ? e.message : e);
    return reply(502, { error: "ai_failed" });
  }
});
