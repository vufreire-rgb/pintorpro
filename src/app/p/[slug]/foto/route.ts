import { coverOf, readPublicSnapshot } from "../pageData";

/** Imagem de capa do link da página (usada pelo WhatsApp e pelas redes para a prévia). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const cover = coverOf(await readPublicSnapshot(slug));
  if (!cover) return new Response("not found", { status: 404 });
  const bytes = Buffer.from(cover.slice(cover.indexOf(",") + 1), "base64");
  return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300, s-maxage=300", "X-Content-Type-Options": "nosniff" } });
}
