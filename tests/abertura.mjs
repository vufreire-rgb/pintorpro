// Abertura do app em condições de celular de verdade: com login (nuvem), abertura LIGADA (navegador sem a marca de automação)
// e toques reais. Garante que a camada azul some e que NADA fica por cima dos botões.
// Precisa do app compilado com NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
import http from "node:http";
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = { id: "user-1", aud: "authenticated", role: "authenticated", email: "a@b.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "*" };
  const send = (c, body) => { res.writeHead(c, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const u = req.url ?? "";
  if (u.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (u.startsWith("/auth/v1/user")) return send(200, user);
  if (u.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe, args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
check((await page.evaluate(() => navigator.webdriver)) === false, "navegador sem marca de automação (a abertura fica ligada)");
await page.getByLabel("E-mail").fill("a@b.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Entrar", exact: true }).tap();
await page.waitForURL("**/onboarding");
check(await page.getByTestId("splash").isVisible().catch(() => false), "a abertura aparece depois de entrar");
await page.waitForTimeout(1800);
check((await page.getByTestId("splash").count()) === 0, "a abertura SOME sozinha (antes ficava para sempre)");
const topo = await page.evaluate(() => {
  const el = document.querySelector("input");
  const b = el.getBoundingClientRect();
  const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return t === el;
});
check(topo, "nada cobre os campos: o que está no ponto do toque é o próprio campo");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva");
await page.getByRole("button", { name: "Continuar" }).tap({ timeout: 3000 });
check(true, "toque real no botão Continuar funciona");
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).tap();
await page.waitForURL(base + "/visitas");
const tab = page.getByRole("tab", { name: /Sem orçamento/ });
await tab.tap({ timeout: 3000 });
check(/Sem orçamento/.test(await page.getByRole("tab", { selected: true }).innerText()), "em Visitas, tocar numa aba troca de aba");
// mesmo se a abertura ficasse presa, ela não pode bloquear toque
const fixos = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed" && getComputedStyle(e).pointerEvents !== "none" && e.getBoundingClientRect().width >= innerWidth * 0.9 && e.getBoundingClientRect().height >= innerHeight * 0.9).length);
check(fixos === 0, "nenhuma camada de tela cheia captura toques");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close(); server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
