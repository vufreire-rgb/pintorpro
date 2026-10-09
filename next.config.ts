import type { NextConfig } from "next";

/** Cabeçalhos de segurança simples e sem risco para o app. (Uma política CSP mais rígida precisa de testes próprios: ver docs/SEGURANCA.md.) */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // admin.medde.com.br abre direto o painel do administrador (a tela só mostra números para o e-mail de administrador).
  async rewrites() {
    return { beforeFiles: [{ source: "/", has: [{ type: "host", value: "admin.medde.com.br" }], destination: "/painel" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
