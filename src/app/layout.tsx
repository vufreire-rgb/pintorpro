import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pintor Pro",
  description: "Orçamentos profissionais para pintores, direto do celular.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
