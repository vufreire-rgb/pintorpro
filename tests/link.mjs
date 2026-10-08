// Link do orçamento: o pintor publica, o cliente abre (sem login) e o pintor vê que foi aberto.
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
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const row = { quote_id: null, token: TOKEN, snapshot: null, views_count: 0, first_viewed_at: null, last_viewed_at: null, updated_at: new Date().toISOString() };
const calls = { publish: [], views: 0, revoked: 0 };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/rest/v1/shared_quotes")) return send(200, row.quote_id ? [{ quote_id: row.quote_id, token: row.token, views_count: row.views_count, first_viewed_at: row.first_viewed_at, last_viewed_at: row.last_viewed_at, updated_at: row.updated_at }] : []);
  if (url.startsWith("/functions/v1/quote-link")) {
    if (req.method === "GET") {
      const t = new URL(url, "http://x").searchParams.get("t");
      if (t !== TOKEN || !row.snapshot) return send(404, { error: "not_found" });
      row.views_count++; calls.views++; row.last_viewed_at = new Date().toISOString(); row.first_viewed_at ??= row.last_viewed_at;
      return send(200, { snapshot: row.snapshot });
    }
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body);
      if (b.revoke) { calls.revoked++; row.quote_id = null; row.snapshot = null; return send(200, { ok: true }); }
      calls.publish.push({ auth: req.headers.authorization ?? "", keys: Object.keys(b.snapshot) });
      row.quote_id = b.quoteId; row.snapshot = b.snapshot; row.updated_at = new Date().toISOString();
      send(200, { token: TOKEN });
    });
    return;
  }
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe, args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["clipboard-read", "clipboard-write"] });
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
await page.getByRole("button", { name: /Só voz e preço fechado/ }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");

// orçamento só com preço
await page.goto(base + "/orcamentos/novo");
await page.getByLabel("Nome do cliente").fill("Dona Maria");
await page.getByLabel("O que será feito").fill("Pintura completa da sala e dos quartos");
await page.getByLabel("Preço fechado").fill("2800");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByText("Dona Maria").first().waitFor();

// publica o link (sem navigator.share no navegador de teste: abre o WhatsApp em outra aba)
await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
await page.getByRole("button", { name: "Enviar pelo WhatsApp" }).click();
await page.waitForFunction(() => window.__opened.length > 0);
const waUrl = decodeURIComponent((await page.evaluate(() => window.__opened[0])));
check(waUrl.includes("wa.me") && waUrl.includes(`/o/${TOKEN}`), "WhatsApp abre com a mensagem e o link: " + waUrl.slice(0, 120));
check(calls.publish.length === 1 && calls.publish[0].auth.startsWith("Bearer "), "link publicado com o login do pintor");
const sent = JSON.stringify(calls.publish[0].keys);
check(!/cost|custo|profit|lucro|photos|logo/i.test(sent), "o que vai para o link não tem custo, lucro, fotos nem logo: " + sent);
await page.getByTestId("link-status").getByText("ainda não abriu").waitFor();
check(true, "pintor vê: link enviado, cliente ainda não abriu");

// copiar o link: ícone ao lado do botão de enviar
check((await page.getByRole("button", { name: "Copiar link" }).count()) === 1 && (await page.getByRole("button", { name: /Ver PDF/ }).count()) === 0, "tela enxuta: ícone de copiar link e sem botão 'Ver PDF'");
await page.getByRole("button", { name: "Copiar link" }).click();
await page.getByText("Link copiado!").waitFor();
check((await page.evaluate(() => navigator.clipboard.readText())).endsWith(`/o/${TOKEN}`), "copiar link coloca o endereço do orçamento na área de transferência");
check((await page.getByRole("button", { name: /Avisar no celular quando/ }).count()) === 0, "sem botão 'avisar no celular' fixo na tela");

// o cliente abre o link, sem login e num aparelho limpo
const client = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const cerrors = [];
client.on("pageerror", (e) => cerrors.push(e.message));
await client.goto(`${base}/o/${TOKEN}`);
await client.getByTestId("total").waitFor();
check((await client.getByTestId("total").textContent()).replace(/\s/g, "").includes("2.800,00"), "cliente vê o valor total sem fazer login");
check(await client.getByText("Pintura completa da sala e dos quartos").first().isVisible(), "cliente vê o que será feito");
check(await client.getByText("Orçamento feito com").isVisible(), "rodapé 'Orçamento feito com Medde'");
check(!(await client.url()).includes("login") && (await client.getByLabel("E-mail").count()) === 0, "não pede login");
check((await client.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), "página não vai para buscadores (noindex)");
check(calls.views === 1, "uma visualização contada");

// o pintor vê que foi aberto
await page.reload();
await page.getByTestId("link-status").getByText(/O cliente abriu 1 vez/).waitFor();
check(true, "pintor vê: o cliente abriu 1 vez");
await page.goto(base + "/orcamentos");
await page.getByText(/Visto /).first().waitFor();
check(true, "lista de orçamentos mostra 'Visto há …'");

// link inexistente
const other = await (await browser.newContext()).newPage();
await other.goto(`${base}/o/ZZZZZZZZZZZZZZZZZZZZZZZZ`);
await other.getByText("Orçamento não encontrado").waitFor();
check(true, "link que não existe: mensagem clara");

// cancelar o link
await page.goBack();
await page.getByRole("button", { name: "Cancelar link" }).click();
await page.waitForTimeout(600);
check(calls.revoked === 1, "cancelar link avisa o servidor");
console.log(errors.length || cerrors.length ? "ERROS DE CONSOLE: " + [...errors, ...cerrors].join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
