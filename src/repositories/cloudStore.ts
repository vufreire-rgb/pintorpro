import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
