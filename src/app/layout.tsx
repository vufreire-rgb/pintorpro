import type { Metadata, Viewport } from "next";
import { AuthGate } from "@/components/AuthGate";
import "@/modules/pwa";
import { APP_NAME, APP_TAGLINE } from "@/shared/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0F3B7A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-white text-ink antialiased"><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
