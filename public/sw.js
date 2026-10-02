/* Service worker do app: deixa o app abrir sem internet. Os DADOS continuam vindo do aparelho/nuvem. */
const VERSION = "v1";
const STATIC = `pp-static-${VERSION}`;
const PAGES = `pp-pages-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.endsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem internet</title><body style="font-family:system-ui;padding:32px;text-align:center"><h1>Sem internet</h1><p>Esta tela ainda não foi aberta neste aparelho. Volte ao painel ou tente de novo quando houver sinal.</p><p><a href="/">Ir para o painel</a></p></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e outros: sempre direto da rede

  // Arquivos versionados (nome muda a cada publicação): cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Páginas e dados da página: rede primeiro (sempre a versão mais nova), cópia guardada se estiver sem internet.
  event.respondWith(
    caches.open(PAGES).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        return Response.error();
      }
    }),
  );
});
