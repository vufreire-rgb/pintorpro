import type { Metadata, Viewport } from "next";
import { AuthGate } from "@/components/AuthGate";
import "@/modules/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pintor Pro",
  description: "Orçamentos profissionais para pintores, direto do celular.",
  appleWebApp: { capable: true, title: "Pintor Pro", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-white text-slate-900 antialiased"><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
