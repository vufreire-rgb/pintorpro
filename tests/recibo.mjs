// Recibo por foto: a IA (simulada) lê valor, data, loja e tipo; o pintor confere e lança o gasto.
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
const today = new Date();
const recent = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
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
  if (url.startsWith("/functions/v1/receipt-scan")) {
    calls.push({ auth: req.headers.authorization ?? "", type: req.headers["content-type"] ?? "" });
    if (mode === "limit") return send(429, { error: "daily_limit" });
    if (mode === "empty") return send(200, { draft: { amountReais: 0, date: "", store: "", kind: "material", description: "" } });
    return send(200, { draft: { amountReais: 387.9, date: recent, store: "Casa das Tintas", kind: "material", description: "2 latas de tinta acrílica 18L" } });
  }
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
await page.getByLabel("E-mail").fill("teste@exemplo.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");
await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => { if (!x.startsWith("pintorpro:v1")) return false; try { return Array.isArray(JSON.parse(localStorage.getItem(x)).clients); } catch { return false; } });
  const d = JSON.parse(localStorage.getItem(k));
  const now = new Date().toISOString();
  d.clients = [{ id: "c1", name: "Ana", phone: "", address: "Rua A" }];
  d.quotes = [{ id: "q1", number: 1, clientId: "c1", siteAddress: "Rua A", status: "won", createdAt: now, closedAt: now, validUntil: now, paymentTerms: "", notes: "", input: { rooms: [], extras: [{ description: "Pintura", priceCents: 300000, costCents: 0 }] }, configSnapshot: {}, engineVersion: "t", result: { totals: { totalCents: 300000, costCents: 0, laborCostCents: 0, materialsCents: 0, profitCents: 300000, profitMargin: 1 }, schedule: { workDays: 0, totalDays: 0, hours: 0 }, serviceLines: [], materialLines: [], measures: [], extras: [], warnings: [] } }];
  d.works = [{ id: "w1", quoteId: "q1", clientId: "c1", title: "Obra da Ana", status: "in_progress", createdAt: now, plannedDays: 1, plannedHours: 8, plannedTotalCents: 300000, plannedCostCents: 0 }];
  localStorage.setItem(k, JSON.stringify(d));
});
await page.goto(base + "/obras/w1");
await page.getByText("Lançar gasto").first().waitFor();

// 1) caminho feliz
await page.getByTestId("recibo-input").setInputFiles("tests/foto-teste.png");
await page.getByText("Confira os dados abaixo").waitFor();
check(calls.length === 1 && calls[0].auth.startsWith("Bearer ") && calls[0].type.startsWith("multipart/form-data"), "foto enviada com o token da pessoa");
check((await page.getByLabel("Valor gasto").inputValue()).replace(",", ".") === "387.9", "valor preenchido");
check((await page.getByLabel("Data do gasto").inputValue()) === recent, "data do recibo preenchida");
check((await page.getByPlaceholder("Ex.: 2 latas de tinta").inputValue()).includes("Casa das Tintas"), "loja e itens na descrição");
await page.getByRole("button", { name: "Lançar gasto", exact: true }).click();
await page.waitForTimeout(500);
const exp = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => { if (!x.startsWith("pintorpro:v1")) return false; try { return Array.isArray(JSON.parse(localStorage.getItem(x)).clients); } catch { return false; } }); return JSON.parse(localStorage.getItem(k)).works[0].expenses; });
check(exp?.length === 1 && exp[0].amountCents === 38790 && exp[0].date === recent && exp[0].kind === "material", "gasto lançado com valor, data e tipo do recibo: " + JSON.stringify(exp));

// 2) não achou o valor
mode = "empty";
await page.getByTestId("recibo-input").setInputFiles("tests/foto-teste.png");
await page.getByText("Não achei o valor no recibo").waitFor();
check(true, "recibo ilegível: pede para digitar o valor");

// 3) limite diário
mode = "limit";
await page.getByTestId("recibo-input").setInputFiles("tests/foto-teste.png");
await page.getByText("limite de recibos por foto de hoje").waitFor();
check(true, "limite diário: explica em português");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
