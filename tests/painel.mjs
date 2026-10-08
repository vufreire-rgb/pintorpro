// Painel do administrador (/painel): números, contatos, ajustes e bloqueio de quem não é administrador.
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
const period = (o = {}) => ({ novasContas: 6, orcamentos: 42, valorOrcadoCents: 12500000, fechados: 9, valorFechadoCents: 3100000, taxaFechamentoPct: 31, voz: 12, recibos: 5, custoIaCents: 130, ...o });
const stats = (p) => ({
  periodo: p,
  meta: { alvo: 100, data: "2026-12-31", atual: 38, faltam: 62, ritmoPorSemana: null },
  assinantes: { pagantes: 38, emTeste: 124, testeVencido: 7, atrasados: 1, cancelados: 2, deltaEmTeste: "+31" },
  atual: period(), anterior: period({ orcamentos: 36 }),
  deltas: { orcamentos: "+17%", novasContas: "+12%", valorOrcado: "+9%", taxaFechamento: "igual", custoIa: "+5%" },
  ativas7d: 61,
  sumidas: [{ id: "s1", name: "Carlos Tintas", email: "carlos@exemplo.com", phone: "(11) 98888-7777", daysSince: 9, quotes: 3 }],
  fimDoTeste: [{ id: "t1", name: "Dona Rosa Pinturas", email: "rosa@exemplo.com", phone: "", daysSince: 2, quotes: 0 }],
  funil: { contas: 171, primeiraVisita: 120, primeiroOrcamento: 90, orcamentoEnviado: 55, orcamentoFechado: 30 },
  serieNovasContas: [1, 0, 2, 1, 0, 1, 1],
  dinheiro: { ligado: false, faturamentoCents: null, impostoCents: null, custoIaCents: 130, fixosCents: 3267, lucroCents: null },
  ajustes: { goalSubscribers: 100, goalDate: "2026-12-31", taxPct: 6, fixedCostCents: 14000, voiceCostCents: 10, receiptCostCents: 2 },
});
const state = { admin: true, calls: [] };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/functions/v1/admin-stats")) {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      const body = JSON.parse(b || "{}");
      state.calls.push({ auth: req.headers.authorization ?? "", body });
      if (!state.admin) return send(403, { error: "forbidden" });
      send(200, stats(body.period ?? "7d"));
    });
    return;
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
await page.getByPlaceholder("Ex.: João Pinturas").fill("Admin Medde");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");

// 1) administrador vê os números
await page.goto(base + "/painel");
await page.getByText("Meta de assinantes").first().waitFor();
check(await page.getByText("Assinantes pagando").isVisible(), "mostra assinantes pagando");
check(await page.getByText("124").first().isVisible(), "mostra quem está em teste");
check(await page.getByText("+17%").first().isVisible(), "mostra a variação contra o período anterior");
check(await page.getByRole("progressbar").getAttribute("aria-valuenow") === "38", "barra da meta em 38%");
check((await page.getByText("Faturamento aparece aqui").count()) === 1, "avisa que o faturamento depende do pagamento");
check(state.calls[0]?.auth.startsWith("Bearer ") && state.calls[0].body.period === "7d", "chama o servidor com o login e 7 dias");

await page.waitForTimeout(3000);
await page.screenshot({ path: `${process.env.OUT ?? "/tmp"}/painel.png`, fullPage: true });

// 2) contatos com WhatsApp
await page.getByRole("button", { name: /^Contas sumidas/ }).click();
await page.getByText("Carlos Tintas").waitFor();
check(await page.getByText("carlos@exemplo.com").isVisible(), "lista o e-mail de quem sumiu");
check((await page.getByRole("link", { name: "Chamar no WhatsApp" }).first().getAttribute("href")) === "https://wa.me/5511988887777", "link do WhatsApp com 55");
await page.getByRole("button", { name: /^Teste acabando/ }).click();
await page.getByText("Dona Rosa Pinturas").waitFor();
check(await page.getByText("Sem WhatsApp cadastrado").isVisible(), "avisa quando não há WhatsApp");

// 3) trocar para Mês
await page.getByRole("tab", { name: "Mês" }).click();
await page.waitForFunction(() => true);
await page.waitForTimeout(500);
check(state.calls.some((c) => c.body.period === "mes"), "troca para o período Mês");

// 4) salvar ajustes
await page.getByRole("button", { name: /^Ajustes do painel/ }).click();
await page.getByLabel("Meta de assinantes").last().fill("250");
await page.getByLabel("Imposto").fill("4");
await page.getByRole("button", { name: "Salvar ajustes" }).click();
await page.getByText("Ajustes salvos.").waitFor();
const saved = state.calls.at(-1).body.settings;
check(saved.goalSubscribers === 250 && saved.taxPct === 4 && saved.fixedCostCents === 14000, "envia os ajustes ao servidor (meta 250, imposto 4%, custos fixos 140)");

// 5) quem não é administrador não vê nada
state.admin = false;
await page.goto(base + "/painel");
await page.getByText("Sem acesso").waitFor();
check(!(await page.getByText("Assinantes pagando").isVisible().catch(() => false)), "não administrador não vê os números");

check(errors.length === 0, "sem erros de console: " + errors.join(" | "));
await browser.close();
server.close();
if (fails.length) { console.log("\nFALHARAM:", fails.length); process.exit(1); }
console.log("\nTudo certo.");
