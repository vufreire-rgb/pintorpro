import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// O Supabase novo chama a chave de "publishable"; aceitamos os dois nomes.
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
export const signUp = (email: string, password: string) => c().auth.signUp({ email, password });
export const signOut = () => c().auth.signOut();

/** Pede ao servidor para apagar a conta de quem está logado (usuário, dados e arquivos). */
export async function deleteAccountOnServer(): Promise<void> {
  const { error } = await c().functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
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
