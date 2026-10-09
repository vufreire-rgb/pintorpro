// Leitura da página pública no servidor (para a prévia do link e a imagem de capa). Sem login, só o que o cliente já vê.
export interface ServerSnapshot { company?: string; headline?: string; about?: string; city?: string; avatar?: string; photos?: string[] }

export async function readPublicSnapshot(slug: string): Promise<ServerSnapshot | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return null;
  try {
    const res = await fetch(`${url}/functions/v1/public-page?s=${encodeURIComponent(slug)}`, { headers: key ? { apikey: key } : {}, next: { revalidate: 300 } });
    if (!res.ok) return null;
    return ((await res.json()) as { snapshot?: ServerSnapshot }).snapshot ?? null;
  } catch {
    return null;
  }
}

/** Imagem de capa do link: a primeira foto de trabalho, ou a foto de perfil. */
export function coverOf(s: ServerSnapshot | null): string | undefined {
  const c = s?.photos?.[0] ?? s?.avatar;
  return typeof c === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(c) ? c : undefined;
}
