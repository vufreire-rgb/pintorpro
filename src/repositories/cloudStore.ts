import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// O Supabase novo chama a chave de "publishable"; aceitamos os dois nomes.
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * O link de "esqueci a senha" chega com o resultado no endereço (#...type=recovery ou #error_code=...).
 * O supabase-js limpa esse trecho ao ler, então guardamos antes de ele ser criado.
 */
export type RecoveryLink = "ok" | "expired" | null;
export const recoveryLink: RecoveryLink =
  typeof window === "undefined"
    ? null
    : /type=recovery/.test(window.location.hash)
      ? "ok"
      : /error_code=otp_expired|error=access_denied/.test(window.location.hash)
        ? "expired"
        : null;

/** false = modo local (sem login), como antes. Liga sozinho quando as chaves existem. */
export const cloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
const c = (): SupabaseClient => (client ??= createClient(url!, anonKey!));

export const getSession = async (): Promise<Session | null> => (await c().auth.getSession()).data.session;

export const onAuthChange = (cb: (s: Session | null) => void): (() => void) => {
  const { data } = c().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
};

export const signIn = (email: string, password: string) => c().auth.signInWithPassword({ email, password });
/** `redirectTo`: para onde o link do e-mail de confirmação leva (precisa estar na lista de Redirect URLs do Supabase). */
/** Entrar com a conta Google (precisa estar ligado no Supabase: docs/LOGIN_COM_GOOGLE.md). */
export const signInWithGoogle = (redirectTo: string) => c().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
export const signUp = (email: string, password: string, redirectTo?: string) =>
  c().auth.signUp({ email, password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined });
export const resendConfirmation = (email: string, redirectTo?: string) =>
  c().auth.resend({ type: "signup", email, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined });
export const requestPasswordReset = (email: string, redirectTo: string) => c().auth.resetPasswordForEmail(email, { redirectTo });
export const updatePassword = (password: string) => c().auth.updateUser({ password });
/** Sai da conta. Sem internet o servidor não responde; nesse caso sai só neste aparelho (a sessão antiga expira sozinha). */
export async function signOut(): Promise<void> {
  const { error } = await c().auth.signOut();
  if (error) await c().auth.signOut({ scope: "local" });
}

/** Pede ao servidor para apagar a conta de quem está logado (usuário, dados e arquivos). */
export async function deleteAccountOnServer(): Promise<void> {
  const { error } = await c().functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
}

/** Painel do administrador (Edge Function admin-stats). Falha com "forbidden" para quem não é o administrador, ou "network". */
export async function adminStatsOnServer(body: { period: "7d" | "mes"; settings?: unknown; addExpense?: unknown; deleteExpense?: string }): Promise<unknown> {
  const { data, error } = await c().functions.invoke("admin-stats", { method: "POST", body });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      const j = await res.json().catch(() => null);
      const code = j?.error;
      throw new Error((typeof code === "string" ? code : "failed") + (typeof j?.detail === "string" ? `: ${j.detail}` : ` (HTTP ${res.status})`));
    }
    throw new Error("network: " + (error as Error).message);
  }
  return data;
}

/** Chama uma função de IA do servidor mandando um arquivo. Falha com o código do erro: "daily_limit", "too_big", "ai_failed", "network"… */
async function invokeAi(fn: string, field: string, blob: Blob, filename: string): Promise<unknown> {
  const body = new FormData();
  body.append(field, blob, filename);
  const { data, error } = await c().functions.invoke(fn, { method: "POST", body });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      const code = (await res.json().catch(() => null))?.error;
      throw new Error(typeof code === "string" ? code : "ai_failed");
    }
    throw new Error("network");
  }
  return data;
}

/** Manda o áudio ditado ao servidor (Edge Function voice-quote). */
export const sendVoice = (audio: Blob): Promise<unknown> =>
  invokeAi("voice-quote", "audio", audio, audio.type.includes("wav") ? "audio.wav" : audio.type.includes("mp4") ? "audio.m4a" : "audio.webm");

/** Manda a foto do recibo ao servidor (Edge Function receipt-scan). */
export const sendReceipt = (image: Blob): Promise<unknown> => invokeAi("receipt-scan", "image", image, "recibo.jpg");

/** Linha de um link público de orçamento (só leitura: quem escreve é a função quote-link). */
export interface QuoteLinkRow { quote_id: string; token: string; views_count: number; first_viewed_at: string | null; last_viewed_at: string | null; updated_at: string }

/** Publica (ou atualiza) o link do orçamento. Devolve o token. */
export async function publishQuoteLink(quoteId: string, snapshot: unknown): Promise<string> {
  const { data, error } = await c().functions.invoke("quote-link", { method: "POST", body: { quoteId, snapshot } });
  if (error || typeof data?.token !== "string") throw new Error(error ? "network" : "failed");
  return data.token as string;
}

/** Apaga o link do orçamento: o endereço deixa de funcionar. */
export async function revokeQuoteLink(quoteId: string): Promise<void> {
  const { error } = await c().functions.invoke("quote-link", { method: "POST", body: { quoteId, revoke: true } });
  if (error) throw new Error("network");
}

/** Links do pintor com as visualizações (leitura protegida pelo RLS: só as linhas dele). */
export async function listQuoteLinks(): Promise<QuoteLinkRow[]> {
  const { data, error } = await c().from("shared_quotes").select("quote_id, token, views_count, first_viewed_at, last_viewed_at, updated_at");
  if (error) throw error;
  return (data ?? []) as QuoteLinkRow[];
}

/** Página pública do cliente: busca o orçamento do link (sem login). Falha com "not_found" ou "network". */
export async function fetchSharedQuote(token: string): Promise<unknown> {
  if (!url) throw new Error("network");
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/quote-link?t=${encodeURIComponent(token)}`, { headers: anonKey ? { apikey: anonKey } : {} });
  } catch {
    throw new Error("network");
  }
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("network");
  return (await res.json()).snapshot;
}

// ---- Página pública do pintor e pedidos de orçamento dos clientes (função public-page) ----
export interface PageRow { slug: string; enabled: boolean; updated_at: string; snapshot?: Record<string, unknown> }
export interface RequestRow { id: string; name: string; phone: string; address: string; message: string; status: "new" | "contacted" | "converted" | "dismissed"; created_at: string }

/** Código do erro que a função devolveu ("slug_taken", "bad_slug"…), ou "network" se nem chegou lá. */
async function fnErrorCode(error: unknown): Promise<string> {
  const res = (error as { context?: Response }).context;
  if (res && typeof res.json === "function") {
    const code = (await res.json().catch(() => null))?.error;
    return typeof code === "string" ? code : "failed";
  }
  return "network";
}

async function invokePage(body: Record<string, unknown>): Promise<void> {
  const { error } = await c().functions.invoke("public-page", { method: "POST", body });
  if (error) throw new Error(await fnErrorCode(error));
}
export const publishPublicPage = (slug: string, snapshot: unknown): Promise<void> => invokePage({ action: "publish", slug, snapshot });
export const disablePublicPage = (): Promise<void> => invokePage({ action: "disable" });

export async function getMyPage(): Promise<PageRow | null> {
  const { data, error } = await c().from("public_pages").select("slug, enabled, updated_at, snapshot").maybeSingle();
  if (error) throw error;
  return data as PageRow | null;
}
export async function listRequests(): Promise<RequestRow[]> {
  const { data, error } = await c().from("quote_requests").select("id, name, phone, address, message, status, created_at").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as RequestRow[];
}
export async function setRequestStatus(id: string, status: RequestRow["status"]): Promise<void> {
  const { error } = await c().from("quote_requests").update({ status }).eq("id", id);
  if (error) throw error;
}
export async function deleteRequestRow(id: string): Promise<void> {
  const { error } = await c().from("quote_requests").delete().eq("id", id);
  if (error) throw error;
}

/** Página do cliente: busca a página publicada (sem login). Falha com "not_found" ou "network". */
export async function fetchPublicPage(slug: string): Promise<unknown> {
  if (!url) throw new Error("network");
  let res: Response;
  try { res = await fetch(`${url}/functions/v1/public-page?s=${encodeURIComponent(slug)}`, { headers: anonKey ? { apikey: anonKey } : {} }); } catch { throw new Error("network"); }
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("network");
  return (await res.json()).snapshot;
}

/** Cliente envia o pedido de orçamento (sem login). Falha com "bad_request", "busy", "not_found" ou "network". */
export async function submitPublicRequest(slug: string, request: Record<string, string>): Promise<void> {
  if (!url) throw new Error("network");
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/public-page`, { method: "POST", headers: { "Content-Type": "application/json", ...(anonKey ? { apikey: anonKey } : {}) }, body: JSON.stringify({ slug, request }) });
  } catch { throw new Error("network"); }
  if (res.ok) return;
  const code = (await res.json().catch(() => null))?.error;
  throw new Error(typeof code === "string" ? code : "network");
}

// ---- Notificações no celular (função push) ----
/** Chave pública do servidor para o navegador criar a inscrição. */
export async function fetchPushKey(): Promise<string> {
  if (!url) throw new Error("network");
  let res: Response;
  try { res = await fetch(`${url}/functions/v1/push?key`, { headers: anonKey ? { apikey: anonKey } : {} }); } catch { throw new Error("network"); }
  const key = res.ok ? (await res.json().catch(() => null))?.publicKey : null;
  if (typeof key !== "string") throw new Error(res.status === 404 ? "not_configured" : "network");
  return key;
}
async function invokePush(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await c().functions.invoke("push", { method: "POST", body });
  if (error) throw new Error(await fnErrorCode(error));
  return (data ?? {}) as Record<string, unknown>;
}
export const savePushSubscription = (subscription: unknown): Promise<unknown> => invokePush({ action: "subscribe", subscription });
export const removePushSubscription = (endpoint: string): Promise<unknown> => invokePush({ action: "unsubscribe", endpoint });
export const sendPushTest = async (): Promise<number> => Number((await invokePush({ action: "test" })).sent ?? 0);

/** Linha de assinatura da pessoa (null se ainda não existe). Só leitura: quem escreve é o servidor. */
export async function pullSubscription(userId: string): Promise<{ status: string; trial_ends_at: string; current_period_end: string | null } | null> {
  const { data, error } = await c().from("subscriptions").select("status, trial_ends_at, current_period_end").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as { status: string; trial_ends_at: string; current_period_end: string | null } | null;
}

export async function pull(userId: string): Promise<{ data: string; updatedAt: string } | null> {
  const { data, error } = await c().from("user_data").select("data, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { data: JSON.stringify(data.data), updatedAt: data.updated_at as string } : null;
}

export async function push(userId: string, raw: string): Promise<string> {
  const updatedAt = new Date().toISOString();
  const { error } = await c().from("user_data").upsert({ user_id: userId, data: JSON.parse(raw), updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

const BUCKET = "visit-files";
const path = (userId: string, id: string) => `${userId}/${id}`;

export async function uploadFile(userId: string, id: string, blob: Blob): Promise<void> {
  const { error } = await c().storage.from(BUCKET).upload(path(userId, id), blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
}

export async function downloadFile(userId: string, id: string): Promise<Blob | null> {
  const { data, error } = await c().storage.from(BUCKET).download(path(userId, id));
  return error ? null : data;
}

export async function removeCloudFile(userId: string, id: string): Promise<void> {
  await c().storage.from(BUCKET).remove([path(userId, id)]);
}
