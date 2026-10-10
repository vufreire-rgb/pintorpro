// Ditado nas observações, localização nos endereços e orçamento por ambientes.
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
const calls = { dictation: 0, publish: [] };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/rest/v1/")) return send(200, []);
  if (url.startsWith("/functions/v1/voice-quote")) { calls.dictation++; req.resume(); req.on("end", () => send(200, { transcript: "parede com mofo perto da janela" })); return; }
  if (url.startsWith("/functions/v1/quote-link")) { let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => { const b = JSON.parse(body); calls.publish.push(b.snapshot); send(200, { token: "AbCdEfGhIjKlMnOpQrStUvWx" }); }); return; }
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["microphone", "geolocation"], geolocation: { latitude: -23.0305, longitude: -45.5565 } });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
await ctx.route("https://nominatim.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ address: { road: "Rua Doutor Emílio Winther", house_number: "120", suburb: "Centro", city: "Taubaté", "ISO3166-2-lvl4": "BR-SP" } }) }));
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

// 1) visita: o microfone das observações dita para o campo (não vai para o orçamento)
await page.getByRole("button", { name: "Nova visita" }).click();
await page.waitForURL(/\/visitas\/[^/]+$/);
const visitUrl = page.url();
await page.getByRole("button", { name: "Ditar por voz" }).click();
await page.getByRole("button", { name: /Parar de ditar/ }).waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Parar de ditar/ }).click();
await page.getByPlaceholder(/Cliente quer cor branco gelo/).waitFor();
await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("mofo"), null, { timeout: 15000 }).catch(() => undefined);
const notes = await page.getByPlaceholder(/Cliente quer cor branco gelo/).inputValue();
check(page.url() === visitUrl, "ditar as observações NÃO muda de tela");
check(notes === "Parede com mofo perto da janela" && calls.dictation === 1, "o que foi dito vira texto nas observações: " + notes);
check((await page.getByRole("link", { name: "Ditar o orçamento por voz" }).count()) === 1, "o ditado do orçamento continua num botão próprio");
await page.getByRole("button", { name: "Ditar por voz" }).click();
await page.getByRole("button", { name: /Parar de ditar/ }).waitFor();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Parar de ditar/ }).click();
await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("janela. Parede"), null, { timeout: 15000 }).catch(() => undefined);
check((await page.getByPlaceholder(/Cliente quer cor branco gelo/).inputValue()).includes("janela. Parede com mofo"), "um segundo ditado vai para o fim, sem apagar o que já estava");

// 2) endereço com localização em outras telas
await page.goto(base + "/visitas/agendar");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/Endereço preenchido/).waitFor();
check((await page.getByLabel("Endereço da visita").inputValue()).startsWith("Rua Doutor Emílio Winther, 120"), "agendar visita: localização preenche o endereço");
await page.goto(base + "/clientes");
await page.getByRole("button", { name: /Novo cliente|Adicionar cliente|Novo/ }).first().click();
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/Endereço preenchido/).waitFor();
check((await page.getByLabel("Endereço", { exact: true }).inputValue()).includes("Taubaté"), "cliente: localização preenche o endereço");

// 3) orçamento só com preço, por ambientes
await page.goto(base + "/orcamentos/novo");
await page.getByRole("button", { name: /Só falar o valor/ }).click();
await page.getByLabel("Nome do cliente").fill("Dona Maria");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/Endereço preenchido/).waitFor();
check((await page.getByLabel("Endereço da obra").inputValue()).includes("Taubaté - SP"), "orçamento: localização preenche o endereço da obra");
await page.getByRole("button", { name: /Separar por ambientes/ }).click();
const names = page.getByPlaceholder("Ex.: Sala");
await names.nth(0).fill("Sala");
await names.nth(1).fill("Quarto");
await page.getByLabel("Valor do ambiente 1").fill("1200");
await page.getByLabel("Valor do ambiente 2").fill("1500");
await page.getByRole("button", { name: "Adicionar ambiente" }).click();
await page.getByPlaceholder("Ex.: Sala").nth(2).fill("Cozinha");
await page.getByLabel("Valor do ambiente 3").fill("800");
check((await page.getByTestId("total").textContent()).replace(/\s/g, "").includes("3.500,00"), "total é a soma dos ambientes: R$ 3.500,00");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
await page.getByRole("button", { name: "Enviar pelo WhatsApp" }).click();
await page.waitForFunction(() => window.__opened.length > 0);
const snap = calls.publish.at(-1);
check(snap.rooms.length === 3 && snap.rooms.map((r) => r.name).join() === "Sala,Quarto,Cozinha" && snap.rooms.map((r) => r.priceCents).join() === "120000,150000,80000", "o link leva os 3 ambientes com os valores: " + snap.rooms.map((r) => `${r.name} ${r.price}`).join(" | "));
check(snap.showRoomPrices === true, "o link sempre mostra o valor por ambiente");

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
