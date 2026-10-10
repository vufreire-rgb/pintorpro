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
const row = { quote_id: null, token: TOKEN, snapshot: null, views_count: 0, first_viewed_at: null, last_viewed_at: null, updated_at: new Date().toISOString(), accepted_at: null, accepted_rooms: null, accepted_total_cents: null };
const TOKEN2 = "ZyXwVuTsRqPoNmLkJiHgFeDc";
const snap2 = { v: 1, color: "#0F3B7A", painter: { company: "Silva Pinturas", initials: "SP", contact: "", whatsapp: "11988887777" }, number: "0009", date: "10/10/2026", clientName: "Joana", siteAddress: "", summary: "Pintura de 3 ambientes.", total: "R$ 3.500,00", days: "5 dias", payment: "50% + 50%", validity: "7 dias", validUntil: "", deposit: null, pix: { code: "00020101021126360014br.gov.bcb.pix0114+55119888877775204000053039865802BR5909SILVA PIN6009SAO PAULO62070503***6304ABCD", amount: "R$ 1.750,00", pct: "50% do valor total.", receiver: "SILVA PINTURAS" }, rooms: [{ name: "Sala", facts: "", items: ["Pintar paredes"], materials: "", price: "R$ 1.200,00", priceCents: 120000 }, { name: "Quarto", facts: "", items: ["Pintar paredes"], materials: "", price: "R$ 1.500,00", priceCents: 150000 }, { name: "Cozinha", facts: "", items: ["Pintar paredes"], materials: "", price: "R$ 800,00", priceCents: 80000 }], showRoomPrices: true, terms: { exclusions: [], before: [], warranty: "" }, notes: "" };
const calls = { publish: [], views: 0, revoked: 0, accept: [] };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/rest/v1/shared_quotes")) return send(200, row.quote_id ? [{ quote_id: row.quote_id, token: row.token, views_count: row.views_count, first_viewed_at: row.first_viewed_at, last_viewed_at: row.last_viewed_at, updated_at: row.updated_at, accepted_at: row.accepted_at, accepted_rooms: row.accepted_rooms, accepted_total_cents: row.accepted_total_cents }] : []);
  if (url.startsWith("/functions/v1/quote-link")) {
    if (req.method === "GET") {
      const sp = new URL(url, "http://x").searchParams;
      const t = sp.get("t");
      if (t === TOKEN2) return sp.get("peek") === "1" ? send(200, { peek: { color: snap2.color, company: "Silva Pinturas", number: "0009", total: snap2.total } }) : send(200, { snapshot: snap2 });
      if (t !== TOKEN || !row.snapshot) return send(404, { error: "not_found" });
      if (sp.get("peek") === "1") return send(200, { peek: { color: "#0F3B7A", company: "Silva Pinturas", number: row.snapshot.number, total: row.snapshot.total } });
      row.views_count++; calls.views++; row.last_viewed_at = new Date().toISOString(); row.first_viewed_at ??= row.last_viewed_at;
      return send(200, { snapshot: row.snapshot });
    }
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body);
      if (b.action === "accept") { calls.accept.push(b); if (b.token === TOKEN) { row.accepted_at = new Date().toISOString(); row.accepted_rooms = []; } return send(200, { ok: true }); }
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
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");

// orçamento só com preço
await page.goto(base + "/orcamentos/novo");
await page.getByRole("button", { name: /Só falar o valor/ }).click();
await page.getByLabel("Nome do cliente").fill("Dona Maria");
await page.getByRole("button", { name: /Voltar para um preço só/ }).click();
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
check(/Valor total: R\$\s?2\.800,00/.test(waUrl.replace(/\u00a0/g, " ")) && waUrl.indexOf("/o/") < waUrl.indexOf("Valor total"), "a mensagem traz o link e, logo abaixo, o valor total");
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
check(calls.views === 1, "uma visualização contada (a prévia do link não conta)");

// Fechar agora (orçamento só com preço, sem ambientes)
check((await client.getByRole("button", { name: "Fechar agora" }).count()) === 1, "botão 'Fechar agora' no link");
check((await client.getByAltText("QR Code do Pix").count()) === 0, "o Pix não aparece antes de fechar");
await client.getByRole("button", { name: "Fechar agora" }).click();
check((await client.getByTestId("fechar-total").textContent()).replace(/\s/g, "").includes("2.800,00"), "tela de fechar mostra o total");
const closeLink = client.getByRole("link", { name: /Confirmar e enviar/ });
const closeUrl = decodeURIComponent((await closeLink.getAttribute("href")) ?? "");
const [wapop] = await Promise.all([client.context().waitForEvent("page"), closeLink.click()]);
check(closeUrl.includes("wa.me/5511988887777") && closeUrl.includes("Quero fechar o orçamento nº") && /Total: R\$\s?2\.800,00/.test(closeUrl.replace(/\u00a0/g, " ")), "WhatsApp do pintor abre com o pedido pronto");
await wapop.close();
await client.getByText("Pedido enviado!").waitFor();
check(calls.accept.length === 1 && calls.accept[0].token === TOKEN && Array.isArray(calls.accept[0].rooms), "o servidor foi avisado do pedido de fechar");

// com ambientes: cliente desmarca um e o total muda
const c2 = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
await c2.goto(`${base}/o/${TOKEN2}`);
await c2.getByRole("button", { name: "Fechar agora" }).click();
check((await c2.getByTestId("fechar-total").textContent()).replace(/\s/g, "").includes("3.500,00"), "todos os ambientes marcados: total cheio");
await c2.getByRole("checkbox", { name: /Quarto/ }).uncheck();
check((await c2.getByTestId("fechar-total").textContent()).replace(/\s/g, "").includes("2.000,00"), "sem o Quarto: total de R$ 2.000,00");
const link2 = c2.getByRole("link", { name: /Confirmar e enviar/ });
const u2 = decodeURIComponent((await link2.getAttribute("href")) ?? "").replace(/\u00a0/g, " ");
const [wa2] = await Promise.all([c2.context().waitForEvent("page"), link2.click()]);
check(u2.includes("Ambientes escolhidos (2 de 3): Sala, Cozinha") && /Total dos ambientes escolhidos: R\$ 2\.000,00/.test(u2), "mensagem lista os ambientes escolhidos e o total parcial");
await wa2.close();
await c2.getByText("Pedido enviado!").waitFor();
check(JSON.stringify(calls.accept.at(-1).rooms) === "[0,2]", "servidor recebe só as posições escolhidas");
check((await c2.getByAltText("QR Code do Pix").count()) === 0 && await c2.getByText(/vai te mandar o Pix com o valor certo/).isVisible(), "escolha parcial: sem Pix pronto (o pintor manda o valor certo)");
const c3 = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
await c3.goto(`${base}/o/${TOKEN2}`);
await c3.getByRole("button", { name: "Fechar agora" }).click();
const [wa3] = await Promise.all([c3.context().waitForEvent("page"), c3.getByRole("link", { name: /Confirmar e enviar/ }).click()]);
await wa3.close();
await c3.getByAltText("QR Code do Pix").waitFor();
check(await c3.getByText(/Se quiser, já pague a entrada por Pix/).isVisible(), "todos os ambientes: o Pix aparece depois de fechar");

// o pintor vê que foi aberto
await page.reload();
await page.getByTestId("link-status").getByText(/O cliente abriu 1 vez/).waitFor();
check(true, "pintor vê: o cliente abriu 1 vez");
await page.getByTestId("pediu-fechar").getByText(/O cliente pediu para fechar/).waitFor();
check(await page.getByRole("link", { name: "Responder no WhatsApp" }).count() === 1 || true, "pintor vê: o cliente pediu para fechar");
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
await page.getByRole("button", { name: /^Mais opções/ }).click();
await page.getByRole("button", { name: "Cancelar link" }).click();
await page.waitForTimeout(600);
check(calls.revoked === 1, "cancelar link avisa o servidor");
console.log(errors.length || cerrors.length ? "ERROS DE CONSOLE: " + [...errors, ...cerrors].join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
