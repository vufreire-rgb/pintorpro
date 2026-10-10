// Edge Function "voice-quote": o pintor dita o orçamento; devolve o texto e um rascunho para ele conferir.
// Segredo necessário (Edge Functions → Secrets): OPENAI_API_KEY. A chave fica SÓ aqui, no servidor; o app nunca a recebe.
// O áudio NÃO é guardado: é enviado à OpenAI para virar texto e descartado.
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- logic.ts (junto aqui para colar no painel) ----
// Lógica pura da função "voice-quote": prompt da IA e limpeza do que ela devolve. Sem rede, fácil de testar.

const PAINTS = ["acrilica", "esmalte", "piso", "grafiato", "cimento_queimado"] as const;
const CONDITIONS = ["nova", "pintada", "descascando", "trincas"] as const;

interface VoiceRoom {
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

interface VoiceDraft {
  clientName: string;
  phone: string;
  address: string;
  rooms: VoiceRoom[];
  /** Preço fechado em reais; 0 = o pintor não falou preço. */
  closedPriceReais: number;
  paymentTerms: string;
  notes: string;
}

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const DAILY_LIMIT = 40;
/** Ditado de texto (só transcrever): bem mais barato que o orçamento por voz, por isso o limite é maior. */
const DICTATION_DAILY_LIMIT = 150;
/** Ditado de um campo de texto: áudio curto. */
const MAX_DICTATION_BYTES = 3 * 1024 * 1024;

const SYSTEM_PROMPT = `Você ajuda um pintor de obras brasileiro. Ele ditou um orçamento falando. Extraia os dados do texto transcrito.
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
function normalizeDraft(raw: unknown): VoiceDraft {
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
const DRAFT_SCHEMA = {
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
function echoesHint(transcript: string, hint: string): boolean {
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(transcript), h = norm(hint);
  if (!t) return false;
  if (h.includes(t) && t.length > 12) return true;
  const hw = new Set(h.split(" "));
  const tw = t.split(" ");
  return tw.length >= 6 && tw.filter((w) => hw.has(w)).length / tw.length >= 0.8;
}
// ---- fim de logic.ts ----

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];
const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const EXTRACT_MODEL = "gpt-4o-mini";

const corsFor = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0]!,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
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

  const day = new Date().toISOString().slice(0, 10);

  // Corpo: o áudio e, opcionalmente, mode="transcribe" (só devolve o texto, para ditar dentro de um campo).
  let audio: File;
  let transcribeOnly = false;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (!(f instanceof File)) return reply(400, { error: "no_audio" });
    audio = f;
    transcribeOnly = form.get("mode") === "transcribe";
  } catch {
    return reply(400, { error: "bad_request" });
  }
  if (audio.size === 0) return reply(400, { error: "no_audio" });

  if (transcribeOnly) {
    if (audio.size > MAX_DICTATION_BYTES) return reply(413, { error: "too_big" });
    // Limite diário do ditado. Se a tabela ainda não existir (migração 0013), segue sem limite e avisa no log.
    const usedD = await admin.from("dictation_usage").select("count").eq("user_id", data.user.id).eq("day", day).maybeSingle();
    if (usedD.error) console.error("dictation_usage indisponível", usedD.error.message);
    else if ((usedD.data?.count ?? 0) >= DICTATION_DAILY_LIMIT) return reply(429, { error: "daily_limit" });
    try {
      const form = new FormData();
      form.append("file", audio, audio.name || "audio.wav");
      form.append("model", TRANSCRIBE_MODEL);
      form.append("language", "pt");
      const hint = "Observações de uma visita de pintura: parede, teto, mofo, infiltração, massa corrida, cor, demão, cliente pediu.";
      form.append("prompt", hint);
      const t = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
      if (!t.ok) throw new Error(`transcribe ${t.status}`);
      let text = String((await t.json()).text ?? "").trim();
      if (echoesHint(text, hint)) text = ""; // silêncio ou barulho: o serviço devolveu o próprio texto de dica
      if (!usedD.error) await admin.from("dictation_usage").upsert({ user_id: data.user.id, day, count: (usedD.data?.count ?? 0) + 1 });
      return reply(200, { transcript: text });
    } catch (e) {
      console.error("voice-quote dictation failed", e instanceof Error ? e.message : e);
      return reply(502, { error: "ai_failed" });
    }
  }

  // Limite diário por pessoa (protege o custo). Se a tabela ainda não existir, segue sem limite e avisa no log.
  const used = await admin.from("voice_usage").select("count").eq("user_id", data.user.id).eq("day", day).maybeSingle();
  if (used.error) console.error("voice_usage indisponível", used.error.message);
  else if ((used.data?.count ?? 0) >= DAILY_LIMIT) return reply(429, { error: "daily_limit" });

  if (audio.size > MAX_AUDIO_BYTES) return reply(413, { error: "too_big" });

  try {
    const form = new FormData();
    form.append("file", audio, audio.name || "audio.wav");
    form.append("model", TRANSCRIBE_MODEL);
    form.append("language", "pt");
    const quoteHint = "Orçamento de pintura: parede, teto, massa corrida, acrílica, esmalte, demão, metros quadrados, pé direito.";
    form.append("prompt", quoteHint);
    const t = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!t.ok) throw new Error(`transcribe ${t.status}`);
    let transcript = String((await t.json()).text ?? "").trim();
    if (echoesHint(transcript, quoteHint)) transcript = "";
    if (!transcript) return reply(200, { transcript: "", draft: normalizeDraft({}) });

    const c = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        temperature: 0,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: transcript }],
        response_format: { type: "json_schema", json_schema: { name: "orcamento", strict: true, schema: DRAFT_SCHEMA } },
      }),
    });
    if (!c.ok) throw new Error(`extract ${c.status}`);
    const content = (await c.json()).choices?.[0]?.message?.content;

    if (!used.error) {
      await admin.from("voice_usage").upsert({ user_id: data.user.id, day, count: (used.data?.count ?? 0) + 1 });
    }
    return reply(200, { transcript, draft: normalizeDraft(content) });
  } catch (e) {
    console.error("voice-quote failed", e instanceof Error ? e.message : e);
    return reply(502, { error: "ai_failed" });
  }
});
