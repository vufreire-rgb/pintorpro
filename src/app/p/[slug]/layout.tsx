import type { Metadata } from "next";

// Página do pintor para o cliente pedir orçamento. Nesta versão não vai para buscadores (o pintor divulga o link).
export const metadata: Metadata = { title: "Peça um orçamento", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
