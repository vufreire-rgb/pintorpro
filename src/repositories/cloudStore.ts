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
