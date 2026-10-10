// Edge Function "voice-quote": o pintor dita o orçamento; devolve o texto e um rascunho para ele conferir.
// Segredo necessário (Edge Functions → Secrets): OPENAI_API_KEY. A chave fica SÓ aqui, no servidor; o app nunca a recebe.
// O áudio NÃO é guardado: é enviado à OpenAI para virar texto e descartado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DAILY_LIMIT, DICTATION_DAILY_LIMIT, DRAFT_SCHEMA, echoesHint, MATERIALS_PROMPT, MATERIALS_SCHEMA, MAX_AUDIO_BYTES, MAX_DICTATION_BYTES, MAX_ORGANIZE_CHARS, normalizeDraft, normalizeMaterials, SYSTEM_PROMPT } from "./logic.ts";

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
  let audio!: File;
  let transcribeOnly = false;
  let organizeText: string | null = null;
  try {
    const form = await req.formData();
    if (form.get("mode") === "organize") {
      organizeText = String(form.get("text") ?? "").trim();
    } else {
      const f = form.get("audio");
      if (!(f instanceof File)) return reply(400, { error: "no_audio" });
      audio = f;
      transcribeOnly = form.get("mode") === "transcribe";
    }
  } catch {
    return reply(400, { error: "bad_request" });
  }

  // Organizar a lista de materiais: texto entra, lista (um item por linha) sai. Usa o mesmo limite diário do ditado.
  if (organizeText !== null) {
    if (!organizeText) return reply(200, { list: "" });
    if (organizeText.length > MAX_ORGANIZE_CHARS) return reply(413, { error: "too_big" });
    const usedO = await admin.from("dictation_usage").select("count").eq("user_id", data.user.id).eq("day", day).maybeSingle();
    if (usedO.error) console.error("dictation_usage indisponível", usedO.error.message);
    else if ((usedO.data?.count ?? 0) >= DICTATION_DAILY_LIMIT) return reply(429, { error: "daily_limit" });
    try {
      const c = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EXTRACT_MODEL,
          temperature: 0,
          messages: [{ role: "system", content: MATERIALS_PROMPT }, { role: "user", content: organizeText }],
          response_format: { type: "json_schema", json_schema: { name: "materiais", strict: true, schema: MATERIALS_SCHEMA } },
        }),
      });
      if (!c.ok) throw new Error(`organize ${c.status}`);
      const list = normalizeMaterials((await c.json()).choices?.[0]?.message?.content);
      if (!usedO.error) await admin.from("dictation_usage").upsert({ user_id: data.user.id, day, count: (usedO.data?.count ?? 0) + 1 });
      return reply(200, { list });
    } catch (e) {
      console.error("voice-quote organize failed", e instanceof Error ? e.message : e);
      return reply(502, { error: "ai_failed" });
    }
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
