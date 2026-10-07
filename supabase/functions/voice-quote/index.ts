// Edge Function "voice-quote": o pintor dita o orçamento; devolve o texto e um rascunho para ele conferir.
// Segredo necessário (Edge Functions → Secrets): OPENAI_API_KEY. A chave fica SÓ aqui, no servidor; o app nunca a recebe.
// O áudio NÃO é guardado: é enviado à OpenAI para virar texto e descartado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DAILY_LIMIT, DRAFT_SCHEMA, MAX_AUDIO_BYTES, normalizeDraft, SYSTEM_PROMPT } from "./logic.ts";

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

  // Limite diário por pessoa (protege o custo). Se a tabela ainda não existir, segue sem limite e avisa no log.
  const day = new Date().toISOString().slice(0, 10);
  const used = await admin.from("voice_usage").select("count").eq("user_id", data.user.id).eq("day", day).maybeSingle();
  if (used.error) console.error("voice_usage indisponível", used.error.message);
  else if ((used.data?.count ?? 0) >= DAILY_LIMIT) return reply(429, { error: "daily_limit" });

  let audio: File;
  try {
    const f = (await req.formData()).get("audio");
    if (!(f instanceof File)) return reply(400, { error: "no_audio" });
    audio = f;
  } catch {
    return reply(400, { error: "bad_request" });
  }
  if (audio.size === 0) return reply(400, { error: "no_audio" });
  if (audio.size > MAX_AUDIO_BYTES) return reply(413, { error: "too_big" });

  try {
    const form = new FormData();
    form.append("file", audio, audio.name || "audio.wav");
    form.append("model", TRANSCRIBE_MODEL);
    form.append("language", "pt");
    form.append("prompt", "Orçamento de pintura: parede, teto, massa corrida, acrílica, esmalte, demão, metros quadrados, pé direito.");
    const t = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!t.ok) throw new Error(`transcribe ${t.status}`);
    const transcript = String((await t.json()).text ?? "").trim();
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
