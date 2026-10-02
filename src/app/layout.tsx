import type { Metadata, Viewport } from "next";
import { AuthGate } from "@/components/AuthGate";
import { APP_NAME, APP_TAGLINE } from "@/shared/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#0F3B7A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-white text-slate-900 antialiased"><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
