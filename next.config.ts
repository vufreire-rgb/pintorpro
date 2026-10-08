import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // admin.medde.com.br abre direto o painel do administrador (a tela só mostra números para o e-mail de administrador).
  async rewrites() {
    return { beforeFiles: [{ source: "/", has: [{ type: "host", value: "admin.medde.com.br" }], destination: "/painel" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
