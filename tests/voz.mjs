// Orçamento por voz no app, contra um Supabase falso (porta 54321) com a função voice-quote simulada.
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
const draft = { clientName: "Dona Maria", phone: "11988887777", address: "Rua das Flores, 10", closedPriceReais: 2800, paymentTerms: "50% de entrada", notes: "",
  rooms: [{ name: "Sala", lengthM: 4, widthM: 5, heightM: 2.7, wallAreaM2: 0, includeCeiling: true, paint: "acrilica", condition: "pintada", doors: 1, windows: 1 }, { name: "Quarto", lengthM: 0, widthM: 0, heightM: 0, wallAreaM2: 0, includeCeiling: false, paint: "acrilica", condition: "pintada", doors: 0, windows: 0 }] };
let mode = "ok";
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
  if (url.startsWith("/functions/v1/voice-quote")) {
    calls.push({ auth: req.headers.authorization ?? "", type: req.headers["content-type"] ?? "" });
    if (mode === "limit") return send(429, { error: "daily_limit" });
    return send(200, { transcript: "cliente dona Maria, sala de 4 por 5, fechado em 2800", draft });
  }
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["microphone"] });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

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

await page.goto(base + "/orcamentos");
await page.getByRole("link", { name: "Ditar orçamento por voz" }).click();
await page.waitForURL("**/orcamentos/voz");

// 1) limite diário: mensagem clara e dá para tentar de novo
mode = "limit";
await page.getByRole("button", { name: "Começar a falar" }).click();
await page.getByRole("button", { name: /Terminei/ }).waitFor();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("limite de orçamentos por voz de hoje").waitFor();
check(true, "limite diário: o app explica em português");

// 2) caminho feliz
mode = "ok";
await page.getByRole("button", { name: "Gravar de novo" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("Confira o que eu entendi").waitFor();
check(calls.length === 2 && calls.every((c) => c.auth.startsWith("Bearer ") && c.type.startsWith("multipart/form-data")), "áudio enviado com o token da pessoa");
check((await page.getByLabel("Cliente").inputValue()) === "Dona Maria", "nome do cliente preenchido");
check(await page.getByText("Sem medida, ficaram de fora: Quarto").isVisible(), "ambiente sem medida é avisado");
check((await page.getByTestId("total").textContent())?.replace(/\s/g, "").includes("2.800,00"), "total = preço fechado ditado: " + (await page.getByTestId("total").textContent()));
await page.getByLabel(/Preço fechado/).fill("3000");
check((await page.getByTestId("total").textContent())?.replace(/\s/g, "").includes("3.000,00"), "mudar o preço na revisão muda o total");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByText("Dona Maria").first().waitFor();
check(true, "orçamento salvo e aberto");
const total = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("pintorpro:v1")))); return db.quotes[0]?.result.totals.totalCents; });
check(total === 300000, "total salvo = 3000,00 (" + total + ")");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
