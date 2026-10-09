// Edge Function "admin-stats": números do painel do titular (assinantes, uso, orçamentos, custos).
// Só responde para o administrador (e-mail em ADMIN_EMAIL, ou o padrão abaixo; ADMIN_USER_ID, se existir, também precisa bater).
// Devolve apenas totais e a lista de contatos dos próprios pintores (nome, e-mail, WhatsApp). Nunca dados dos clientes deles.
import { createClient } from "npm:@supabase/supabase-js@2";
import { brDay, buildStats, DEFAULT_SETTINGS, sanitizeExpense, sanitizeSettings, type AuthUser, type Doc, type Expense, type Settings, type Shared, type Sub, type Usage } from "./logic.ts";

const ALLOWED = ["https://medde.com.br", "https://www.medde.com.br", "https://admin.medde.com.br", "https://pintorpro-gules.vercel.app", "http://localhost:3000"];
const DEFAULT_ADMIN = "vufreire@gmail.com";

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
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "unauthorized" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth.user) return reply(401, { error: "unauthorized" });
  const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? DEFAULT_ADMIN).trim().toLowerCase();
  const adminId = Deno.env.get("ADMIN_USER_ID")?.trim();
  if ((auth.user.email ?? "").toLowerCase() !== adminEmail || (adminId && auth.user.id !== adminId)) return reply(403, { error: "forbidden" });

  let body: { period?: string; settings?: unknown; addExpense?: unknown; deleteExpense?: unknown } = {};
  try { body = await req.json(); } catch { /* sem corpo: usa 7 dias */ }
  const kind = body.period === "mes" ? "mes" : "7d";

  try {
    const cur = await db.from("admin_settings").select("*").eq("id", 1).maybeSingle();
    let settings: Settings = cur.data
      ? { goalSubscribers: cur.data.goal_subscribers, goalDate: cur.data.goal_date, taxPct: Number(cur.data.tax_pct), fixedCostCents: cur.data.fixed_cost_cents, voiceCostCents: cur.data.voice_cost_cents, receiptCostCents: cur.data.receipt_cost_cents }
      : DEFAULT_SETTINGS;
    if (body.settings) {
      settings = sanitizeSettings(body.settings, settings);
      const up = await db.from("admin_settings").upsert({ id: 1, goal_subscribers: settings.goalSubscribers, goal_date: settings.goalDate, tax_pct: settings.taxPct, fixed_cost_cents: settings.fixedCostCents, voice_cost_cents: settings.voiceCostCents, receipt_cost_cents: settings.receiptCostCents, updated_at: new Date().toISOString() });
      if (up.error) throw new Error("settings " + up.error.message);
    }

    if (body.addExpense) {
      const e = sanitizeExpense(body.addExpense, brDay(new Date()));
      if (!e) return reply(400, { error: "invalid_expense" });
      const ins = await db.from("admin_expenses").insert({ day: e.day, description: e.description, amount_cents: e.amountCents });
      if (ins.error) throw new Error("expenses " + ins.error.message);
    }
    if (typeof body.deleteExpense === "string" && /^[0-9a-f-]{36}$/i.test(body.deleteExpense)) {
      const del = await db.from("admin_expenses").delete().eq("id", body.deleteExpense);
      if (del.error) throw new Error("expenses " + del.error.message);
    }

    const users: AuthUser[] = [];
    for (let page = 1; page <= 50; page++) {
      const r = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (r.error) throw new Error("users " + r.error.message);
      for (const u of r.data.users) users.push({ id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at });
      if (r.data.users.length < 1000) break;
    }
    const all = async <T>(table: string, cols: string): Promise<T[]> => {
      const out: T[] = [];
      for (let from = 0; from < 100_000; from += 1000) {
        const r = await db.from(table).select(cols).range(from, from + 999);
        if (r.error) throw new Error(`${table} ${r.error.message}`);
        out.push(...((r.data ?? []) as T[]));
        if ((r.data ?? []).length < 1000) break;
      }
      return out;
    };
    const [subs, docs, voice, receipts, shared, expenseRows] = await Promise.all([
      all<Sub>("subscriptions", "user_id,status,trial_ends_at,current_period_end"),
      all<Doc>("user_data", "user_id,updated_at,company:data->company,visits:data->visits,quotes:data->quotes"),
      all<Usage>("voice_usage", "user_id,day,count"),
      all<Usage>("receipt_usage", "user_id,day,count"),
      all<Shared>("shared_quotes", "user_id,views_count"),
      all<{ id: string; day: string; description: string; amount_cents: number }>("admin_expenses", "id,day,description,amount_cents").catch(() => []), // antes da migração 0011 a lista fica vazia
    ]);
    const expenses: Expense[] = expenseRows.map((r) => ({ id: r.id, day: r.day, description: r.description, amountCents: r.amount_cents }));
    return reply(200, buildStats({ now: new Date(), users, subs, docs, voice, receipts, shared, settings, expenses }, kind) as unknown as Record<string, unknown>);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("admin-stats", detail);
    // Só chega aqui quem já foi confirmado como administrador, então o motivo pode ser mostrado (ajuda a achar o problema).
    return reply(500, { error: "failed", detail: detail.slice(0, 300) });
  }
});
