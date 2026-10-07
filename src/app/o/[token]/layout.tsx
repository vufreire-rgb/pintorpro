import type { Metadata } from "next";

// Página do cliente: não deve aparecer em buscadores.
export const metadata: Metadata = { title: "Orçamento", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
