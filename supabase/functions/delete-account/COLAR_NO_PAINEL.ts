// Edge Function "delete-account": a própria pessoa pede a exclusão da conta dela.
// Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem nas Edge Functions (o Supabase injeta; nada para configurar).
// A chave de administrador fica SÓ aqui, no servidor. O app nunca a recebe.
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- logic.ts (junto aqui para colar no painel) ----
/**
 * Exclusão de conta (roda no servidor, com a chave de administrador do Supabase).
 * Apaga, nesta ordem: arquivos (fotos e áudios) → dados da conta → usuário.
 * O usuário é o último passo: se algo falhar antes, a pessoa ainda consegue entrar e tentar de novo.
 */
type Err = { message: string } | null;

interface AdminLike {
  storage: {
    from(bucket: string): {
      list(path: string, opts: { limit: number; offset: number }): Promise<{ data: { name: string }[] | null; error: Err }>;
      remove(paths: string[]): Promise<{ error: Err }>;
    };
  };
  from(table: string): { delete(): { eq(column: string, value: string): Promise<{ error: Err }> } };
  auth: { admin: { deleteUser(id: string): Promise<{ error: Err }> } };
}

const BUCKET = "visit-files";
const PAGE = 1000;
const BATCH = 100;

async function deleteAccount(admin: AdminLike, userId: string): Promise<{ filesRemoved: number }> {
  const bucket = admin.storage.from(BUCKET);

  const names: string[] = [];
  for (;;) {
    // Sempre offset 0: depois de remover, o que sobra "sobe" na lista.
    const { data, error } = await bucket.list(userId, { limit: PAGE, offset: 0 });
    if (error) throw new Error(`list: ${error.message}`);
    if (!data || data.length === 0) break;
    const batch = data.map((f) => `${userId}/${f.name}`);
    for (let i = 0; i < batch.length; i += BATCH) {
      const { error: rmError } = await bucket.remove(batch.slice(i, i + BATCH));
      if (rmError) throw new Error(`remove: ${rmError.message}`);
    }
    names.push(...batch);
  }

  const { error: dataError } = await admin.from("user_data").delete().eq("user_id", userId);
  if (dataError) throw new Error(`user_data: ${dataError.message}`);

  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) throw new Error(`user: ${userError.message}`);

  return { filesRemoved: names.length };
}
// ---- fim de logic.ts ----

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];

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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Quem está pedindo é descoberto pelo token (não por um id enviado no corpo): só dá para excluir a PRÓPRIA conta.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply(401, { error: "unauthorized" });

  try {
    const { filesRemoved } = await deleteAccount(admin as never, data.user.id);
    return reply(200, { ok: true, filesRemoved });
  } catch (e) {
    console.error("delete-account failed", e instanceof Error ? e.message : e);
    return reply(500, { error: "delete_failed" });
  }
});
