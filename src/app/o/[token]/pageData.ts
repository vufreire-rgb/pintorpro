// Leitura mínima do orçamento no servidor, só para a prévia do link. Não conta visualização nem avisa o pintor (peek=1).
export interface QuotePeek { color: string; company: string; number: string; total: string }

export async function readQuotePeek(token: string): Promise<QuotePeek | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^[A-Za-z0-9_-]{24}$/.test(token)) return null;
  try {
    const res = await fetch(`${url}/functions/v1/quote-link?t=${encodeURIComponent(token)}&peek=1`, { headers: key ? { apikey: key } : {}, next: { revalidate: 120 } });
    if (!res.ok) return null;
    return ((await res.json()) as { peek?: QuotePeek }).peek ?? null;
  } catch {
    return null;
  }
}
