import type { Metadata } from "next";
import { readQuotePeek } from "./pageData";

// Página do cliente: não deve aparecer em buscadores. A prévia do link (WhatsApp) mostra quem enviou, o número e o total.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const base: Metadata = { title: "Orçamento", robots: { index: false, follow: false } };
  const p = await readQuotePeek(token);
  if (!p) return base;
  const title = `Orçamento${p.number ? ` nº ${p.number}` : ""} · ${p.company}`;
  const description = `${p.total ? `Total ${p.total}. ` : ""}Toque para ver os detalhes e responder.`;
  return { ...base, title, description, openGraph: { type: "website", title, description, url: `https://medde.com.br/o/${token}`, locale: "pt_BR", siteName: "Medde", images: [{ url: `https://medde.com.br/o/${token}/capa`, width: 1200, height: 630 }] } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
