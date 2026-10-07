// Notificações no celular: ligar, testar e desligar em Ajustes. O navegador de teste não fala com o Google (FCM),
// então a inscrição é simulada; o que se confere é o fluxo do app e o que ele manda ao servidor.
// Precisa de build com NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon e `next start`.
import http from "node:http";
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = { id: "user-1", aud: "authenticated", role: "authenticated", email: "teste@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const PUBKEY = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
const calls = [];
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/functions/v1/push")) {
    if (req.method === "GET") { calls.push({ get: "key" }); return send(200, { publicKey: PUBKEY }); }
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const body = JSON.parse(b); calls.push({ ...body, auth: req.headers.authorization ?? "" }); send(200, body.action === "test" ? { sent: 1 } : { ok: true }); });
    return;
  }
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const fakePush = (permission) => () => {
  const state = { permission: window.__perm ?? "default" };
  const sub = { endpoint: "https://push.example/abc", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } }; }, async unsubscribe() { window.__sub = null; return true; } };
  window.__sub = null;
  const reg = { pushManager: { getSubscription: async () => window.__sub, subscribe: async (o) => { window.__opts = { userVisibleOnly: o.userVisibleOnly, keyLen: o.applicationServerKey.length }; window.__sub = sub; return sub; } } };
  Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(reg) });
  Object.defineProperty(Notification, "permission", { get: () => state.permission });
  Notification.requestPermission = async () => { state.permission = window.__willGrant === false ? "denied" : "granted"; return state.permission; };
};

async function openSettings(ctx, init) {
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
  if (init) await page.addInitScript(init);
  await page.goto(base);
  await page.getByLabel("E-mail").fill("teste@exemplo.com");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/onboarding");
  await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
  await page.getByRole("button", { name: "Começar" }).click();
  await page.waitForURL(base + "/visitas");
  await page.goto(base + "/configuracoes");
  await page.getByText("Notificações").first().click();
  return page;
}

const browser = await chromium.launch({ executablePath: exe, args: ["--disable-blink-features=AutomationControlled"] });
const errors = [];

// 1) ligar, testar e desligar
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await openSettings(ctx, fakePush());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByText("Desligadas neste celular.").waitFor();
  check(true, "começa desligado");
  await page.getByRole("button", { name: "Ligar avisos neste celular" }).click();
  await page.getByText("Ligadas neste celular.").waitFor();
  const opts = await page.evaluate(() => window.__opts);
  check(opts.userVisibleOnly === true && opts.keyLen === 65, "inscrição criada com a chave pública do servidor: " + JSON.stringify(opts));
  const sub = calls.find((c) => c.action === "subscribe");
  check(!!sub && sub.auth.startsWith("Bearer ") && sub.subscription.endpoint === "https://push.example/abc" && !!sub.subscription.keys.auth, "inscrição enviada ao servidor com o login do pintor");
  await page.getByRole("button", { name: "Enviar teste" }).click();
  await page.getByText("Teste enviado").waitFor();
  check(calls.some((c) => c.action === "test"), "teste pedido ao servidor");
  await page.getByRole("button", { name: "Desligar", exact: true }).click();
  await page.getByText("Desligadas neste celular.").waitFor();
  check(calls.some((c) => c.action === "unsubscribe" && c.endpoint === "https://push.example/abc"), "desligar avisa o servidor");
  await ctx.close();
}

// 2) permissão bloqueada
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await openSettings(ctx, () => { window.__perm = "denied"; });
  await page.addInitScript(fakePush());
  await page.reload();
  await page.getByText("Notificações").first().click();
  await page.getByText(/estão bloqueadas/).waitFor();
  check((await page.getByRole("button", { name: "Ligar avisos neste celular" }).count()) === 0, "bloqueado: explica como liberar e não mostra o botão de ligar");
  await ctx.close();
}

// 3) iPhone sem instalar
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await openSettings(ctx, () => { delete window.PushManager; });
  await page.getByText(/No iPhone, primeiro instale/).waitFor();
  check(true, "iPhone sem app instalado: explica que precisa instalar na tela inicial");
  await ctx.close();
}
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
