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
await page.getByRole("button", { name: "Gravar áudio" }).click();
await page.getByRole("button", { name: /Sim, avisei/ }).click();
await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Parar e guardar/ }).click();
await page.getByText("Áudio guardado e escrito nas Observações.").waitFor();
const notes = await page.getByPlaceholder(/Cliente quer cor branco gelo/).inputValue();
check(page.url() === visitUrl, "gravar o áudio NÃO muda de tela");
check(notes === "Parede com mofo perto da janela" && calls.dictation === 1, "o áudio é guardado e também vira texto nas Observações: " + notes);
check((await page.getByText(/Áudio 1 ·/).count()) === 1, "o áudio continua guardado na visita");
check((await page.getByRole("button", { name: "Ditar por voz" }).count()) === 0, "só um microfone na visita (o das Observações saiu)");
check((await page.getByRole("link", { name: "Ditar o orçamento por voz" }).count()) === 1, "o ditado do orçamento continua num botão próprio");
await page.getByRole("button", { name: "Gravar áudio" }).click();
await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Parar e guardar/ }).click();
await page.getByText("Áudio guardado e escrito nas Observações.").waitFor();
check((await page.getByPlaceholder(/Cliente quer cor branco gelo/).inputValue()).includes("janela. Parede com mofo"), "um segundo áudio soma ao fim, sem apagar o que já estava");

// 1b) foto com legenda ditada
await page.getByTestId("photo-input").setInputFiles("tests/foto-teste.png");
await page.getByRole("button", { name: "Pôr no PDF" }).first().click();
await page.getByLabel("Legenda da foto 1", { exact: true }).fill("Teto");
const before = calls.dictation;
await page.getByRole("button", { name: "Ditar legenda da foto 1" }).click();
await page.getByRole("button", { name: /Parar de ditar/ }).waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Parar de ditar/ }).click();
await page.waitForFunction(() => document.querySelector('textarea[aria-label="Legenda da foto 1"]')?.value.includes("mofo"), null, { timeout: 15000 }).catch(() => undefined);
const cap = await page.getByLabel("Legenda da foto 1", { exact: true }).inputValue();
check(calls.dictation === before + 1 && cap === "Teto. Parede com mofo perto da janela", "legenda da foto: o que foi dito entra no fim do texto: " + cap);
const stored = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("pintorpro:v1")); const d = JSON.parse(localStorage.getItem(k)); return Object.values(d.visits[0].photoMeta ?? {}).map((m) => m.caption).filter(Boolean); });
check(stored.includes("Teto. Parede com mofo perto da janela"), "a legenda fica guardada na visita (vai no PDF com a foto)");

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

// 3) visita sem cliente: define o cliente ali mesmo, sem sair da tela
await page.goto(visitUrl);
await page.getByRole("button", { name: "Definir cliente" }).click();
await page.getByLabel("Nome do cliente").fill("Ana Lima");
await page.getByLabel(/Telefone/).fill("12991122596");
await page.getByRole("button", { name: "Salvar cliente" }).click();
await page.getByText("Ana Lima").first().waitFor();
check(page.url() === visitUrl && (await page.getByRole("button", { name: "Definir cliente" }).count()) === 0, "cliente definido na própria visita (sem terminar a visita)");

// 4) orçamento a partir da visita: observações vêm da visita; ambientes por padrão; materiais; localização
await page.getByRole("link", { name: "Montar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/novo\?visita=/);
await page.getByRole("button", { name: /Só falar o valor/ }).click().catch(() => undefined);
check((await page.getByLabel("Observações para o cliente (opcional)").inputValue()).includes("mofo"), "observações da visita já vêm preenchidas no orçamento");
check((await page.getByText("Ambientes e valores").count()) === 1, "orçamento simples já começa separado por ambientes");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/Endereço preenchido/).waitFor();
check((await page.getByLabel("Endereço da obra").inputValue()).includes("Taubaté - SP"), "orçamento: localização preenche o endereço da obra");
const names = page.getByPlaceholder("Ex.: Sala");
await names.nth(0).fill("Sala");
await names.nth(1).fill("Quarto");
await page.getByLabel("Valor do ambiente 1").fill("1200");
await page.getByLabel("Valor do ambiente 2").fill("1500");
await page.getByRole("button", { name: "Adicionar ambiente" }).click();
await page.getByPlaceholder("Ex.: Sala").nth(2).fill("Cozinha");
await page.getByLabel("Valor do ambiente 3").fill("800");
check((await page.getByTestId("total").textContent()).replace(/\s/g, "").includes("3.500,00"), "total é a soma dos ambientes: R$ 3.500,00");
await page.getByLabel("Lista de materiais da obra (opcional)").fill("2 latas de tinta acrílica 18 L\n1 massa corrida 25 kg");
check((await page.getByRole("button", { name: "Não", exact: true }).count()) >= 1, "lista de materiais começa escondida do cliente (Não)");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
await page.getByRole("button", { name: "Enviar pelo WhatsApp" }).click();
await page.waitForFunction(() => window.__opened.length > 0);
let snap = calls.publish.at(-1);
check(snap.rooms.length === 3 && snap.rooms.map((r) => r.name).join() === "Sala,Quarto,Cozinha" && snap.rooms.map((r) => r.priceCents).join() === "120000,150000,80000", "o link leva os 3 ambientes com os valores: " + snap.rooms.map((r) => `${r.name} ${r.price}`).join(" | "));
check(snap.showRoomPrices === true, "o link sempre mostra o valor por ambiente");
check(!snap.materialsList, "materiais escondidos: não vão no link");

// 5) materiais na tela do orçamento: mostrar no link, salvar e enviar à loja
await page.getByText("Materiais da obra").first().click();
await page.locator("section", { hasText: "Materiais da obra" }).getByRole("button", { name: "Não", exact: true }).click();
await page.getByRole("button", { name: "Salvar lista" }).click();
await page.getByText("Lista salva.").waitFor();
await page.evaluate(() => { window.__opened.length = 0; });
await page.getByRole("button", { name: "Enviar para a loja de tintas" }).click();
await page.waitForFunction(() => window.__opened.length > 0);
const shop = decodeURIComponent(await page.evaluate(() => window.__opened[0]));
check(shop.includes("Lista de materiais — obra de Ana Lima") && shop.includes("• 2 latas de tinta acrílica 18 L") && shop.includes("• 1 massa corrida 25 kg"), "mensagem para a loja traz a obra e os itens");
await page.getByRole("button", { name: "Enviar pelo WhatsApp" }).click();
await page.waitForTimeout(800);
snap = calls.publish.at(-1);
check(JSON.stringify(snap.materialsList) === JSON.stringify(["2 latas de tinta acrílica 18 L", "1 massa corrida 25 kg"]), "com 'mostrar' ligado, a lista vai no link: " + JSON.stringify(snap.materialsList));

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
