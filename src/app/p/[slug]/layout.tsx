import type { Metadata } from "next";
import { coverOf, readPublicSnapshot } from "./pageData";

// Página do pintor para o cliente pedir orçamento. Nesta versão não vai para buscadores (o pintor divulga o link).
// A prévia do link (WhatsApp, Instagram) mostra o nome, a frase e uma foto do trabalho dele.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await readPublicSnapshot(slug);
  const base: Metadata = { title: "Peça um orçamento", robots: { index: false, follow: false } };
  if (!s?.company) return base;
  const title = `${s.company} · Peça seu orçamento de pintura`;
  const description = (s.headline || s.about || "Peça seu orçamento de pintura sem compromisso.").slice(0, 160);
  const images = coverOf(s) ? [{ url: `https://medde.com.br/p/${slug}/foto`, width: 1000, height: 1000 }] : undefined;
  return { ...base, title, description, openGraph: { type: "website", title, description, url: `https://medde.com.br/p/${slug}`, locale: "pt_BR", siteName: "Medde", images } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
