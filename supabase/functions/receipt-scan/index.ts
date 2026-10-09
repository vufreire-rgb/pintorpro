// Edge Function "receipt-scan": o pintor fotografa um recibo; devolve valor, data, loja e tipo para ele conferir.
// Usa o mesmo segredo OPENAI_API_KEY da função voice-quote. A foto NÃO é guardada: vai à OpenAI para ser lida e é descartada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DAILY_LIMIT, MAX_IMAGE_BYTES, normalizeReceipt, RECEIPT_SCHEMA, SYSTEM_PROMPT } from "./logic.ts";

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
          { role: "user", content: [{ type: "text", text: "Leia este recibo." }, { type: "image_url", image_url: { url: `data:${/^image\/(jpeg|png|webp|heic|heif)$/.test(image.type) ? image.type : "image/jpeg"};base64,${b64}`, detail: "high" } }] },
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
