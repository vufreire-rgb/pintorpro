// Assinatura: avisos antes/depois de vencer, bloqueio e saídas (pagar, baixar dados, excluir, sair). Supabase falso na porta 54321.
// Precisa do app compilado com NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
// NEXT_PUBLIC_BILLING_ENFORCE=1 NEXT_PUBLIC_CHECKOUT_URL=https://pagar.exemplo/medde
import http from "node:http";
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const DAY = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = { id: "user-1", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
let sub = null; // linha devolvida em /rest/v1/subscriptions
let subFails = false;
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/subscriptions")) return subFails ? send(503, { message: "fora do ar" }) : send(200, sub ? [sub] : []);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const trial = (endMs) => ({ status: "trial", trial_ends_at: iso(endMs), current_period_end: null });
const visible = (loc) => loc.isVisible().catch(() => false);

sub = trial(20 * DAY);
await page.goto(base);
await page.getByLabel("E-mail").fill("ana@exemplo.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");
await page.waitForTimeout(800);
check(!(await visible(page.getByTestId("billing-banner"))), "teste com 20 dias de sobra: nenhum aviso");

await page.goto(base + "/configuracoes");
await page.getByText(/Teste grátis até/).waitFor();
check(await visible(page.getByText("Valor: R$ 29,90 por mês.")), "Ajustes mostra a situação e o valor da assinatura");

sub = trial(2 * DAY);
await page.goto(base + "/visitas");
await page.getByText("Seu teste grátis termina em 2 dias").waitFor();
check(await page.getByRole("link", { name: "Assinar agora" }).first().getAttribute("href") === "https://pagar.exemplo/medde", "3 dias antes: aviso com botão de pagar");

sub = trial(-1 * DAY);
await page.goto(base + "/visitas");
await page.getByText("Seu teste grátis terminou").waitFor();
check(await visible(page.getByText(/bloqueado em 2 dias/)), "venceu há 1 dia: avisa que bloqueia em 2 dias e o app ainda funciona");
check(await visible(page.getByRole("button", { name: /nova visita/i })), "durante os 3 dias de aviso o app continua usável");

sub = trial(-4 * DAY);
await page.goto(base + "/visitas");
await page.getByTestId("blocked-screen").waitFor();
check(!(await visible(page.getByRole("button", { name: /nova visita/i }))), "passou dos 3 dias: o app NÃO abre");
check(await page.getByRole("link", { name: /Assinar por R\$ 29,90 por mês/ }).getAttribute("href") === "https://pagar.exemplo/medde", "tela de bloqueio tem o botão de assinar");
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar meus dados" }).click()]);
check(/^medde-meus-dados-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), "bloqueado ainda consegue baixar os próprios dados");
check(await visible(page.getByRole("button", { name: "Excluir minha conta" })), "bloqueado ainda consegue excluir a conta");
await page.goto(base + "/privacidade");
await page.getByText("Política de privacidade").first().waitFor();
check(true, "páginas públicas abrem mesmo bloqueado");

subFails = true;                                    // servidor fora do ar: usa o que já sabia
await page.goto(base + "/visitas");
await page.getByTestId("blocked-screen").waitFor();
check(true, "sem resposta do servidor, continua valendo a última situação conhecida");
subFails = false;

sub = { status: "active", trial_ends_at: iso(-60 * DAY), current_period_end: iso(30 * DAY) };
await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).waitFor();
check(!(await visible(page.getByTestId("billing-banner"))), "assinatura em dia: acesso liberado e sem aviso");

sub = { status: "active", trial_ends_at: iso(-60 * DAY), current_period_end: iso(-1 * DAY) };
await page.goto(base + "/visitas");
await page.getByText("Pagamento pendente").waitFor();
check(true, "assinatura vencida há 1 dia: 'Pagamento pendente' com contagem para o bloqueio");

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close(); server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
