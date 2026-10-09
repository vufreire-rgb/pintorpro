// Página pública do pintor: ele ativa em Ajustes, o cliente pede orçamento sem login e o pedido chega no app.
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
const state = { page: null, requests: [], published: [], posted: [], patched: [], deleted: 0 };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) return send(204);
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
  if (url.startsWith("/rest/v1/public_pages")) return send(200, state.page ? { slug: state.page.slug, enabled: state.page.enabled, updated_at: new Date().toISOString(), snapshot: state.page.snapshot } : null);
  if (url.startsWith("/rest/v1/quote_requests")) {
    if (req.method === "GET") return send(200, state.requests);
    const id = new URL(url, "http://x").searchParams.get("id")?.replace("eq.", "");
    if (req.method === "PATCH") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const s = JSON.parse(b).status; state.patched.push({ id, status: s }); const r = state.requests.find((x) => x.id === id); if (r) r.status = s; send(204); }); return; }
    if (req.method === "DELETE") { state.deleted++; state.requests = state.requests.filter((x) => x.id !== id); return send(204); }
  }
  if (url.startsWith("/functions/v1/public-page")) {
    if (req.method === "GET") {
      const s = new URL(url, "http://x").searchParams.get("s");
      return state.page?.enabled && state.page.slug === s ? send(200, { snapshot: state.page.snapshot }) : send(404, { error: "not_found" });
    }
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      const body = JSON.parse(b);
      if (body.action === "publish") { state.published.push({ auth: req.headers.authorization ?? "", slug: body.slug }); state.page = { slug: body.slug, enabled: true, snapshot: body.snapshot }; return send(200, { ok: true }); }
      if (body.action === "disable") { state.page.enabled = false; return send(200, { ok: true }); }
      if (body.request) {
        state.posted.push(body);
        if (String(body.request.phone).replace(/\D/g, "").length < 10) return send(400, { error: "bad_request" });
        state.requests.unshift({ id: "r" + state.posted.length, name: body.request.name, phone: body.request.phone.replace(/\D/g, ""), address: body.request.address, message: body.request.message, status: "new", created_at: new Date().toISOString() });
        return send(200, { ok: true });
      }
      send(400, { error: "bad_request" });
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
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas & Cia");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");

// 1) o pintor ativa a página
await page.goto(base + "/configuracoes");
await page.getByText("Página para receber pedidos").first().click();
check((await page.getByLabel("Endereço da sua página").inputValue()) === "silva-pinturas-cia", "endereço sugerido pelo nome do negócio");
await page.getByPlaceholder("Ex.: Pintura residencial com capricho").fill("Pintura residencial com capricho");
await page.getByLabel("Escolher foto de perfil").setInputFiles("tests/foto-teste.png");
await page.getByAltText("Sua foto de perfil").waitFor();
await page.getByLabel("Adicionar fotos dos trabalhos").setInputFiles(["tests/foto-teste.png", "tests/foto-teste.png"]);
await page.getByAltText("Trabalho 2").waitFor();
check(await page.getByText("2 de 6").isVisible(), "duas fotos de trabalho adicionadas (2 de 6)");
await page.getByRole("button", { name: "Remover foto 2" }).click();
check(await page.getByText("1 de 6").isVisible(), "remover foto funciona");
await page.getByRole("button", { name: "Ativar página" }).click();
await page.getByText("Página ativada").waitFor();
const snap0 = state.page.snapshot;
check(/^data:image\/jpeg;base64,/.test(snap0.avatar ?? "") && snap0.photos?.length === 1 && /^data:image\/jpeg;base64,/.test(snap0.photos[0]), "foto de perfil e 1 foto de trabalho vão como JPEG na página");
check((snap0.avatar ?? "").length < 80000 && snap0.photos[0].length < 260000, "fotos reduzidas dentro do limite do servidor");
await page.getByAltText(/QR code que abre/).waitFor();
check(true, "QR code aparece depois de ativar");
const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Baixar para imprimir" }).click();
const file = await dl;
check(/^qr-silva-pinturas-cia\.png$/.test(file.suggestedFilename()), "imagem do QR baixada: " + file.suggestedFilename());
const png = await (async () => { const s = await file.createReadStream(); const chunks = []; for await (const c of s) chunks.push(c); return Buffer.concat(chunks); })();
check(png.length > 5000 && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350, "cartaz do QR é um PNG 1080×1350");
check(state.published.length === 1 && state.published[0].auth.startsWith("Bearer ") && state.published[0].slug === "silva-pinturas-cia", "página publicada com o login do pintor");
check(!/pix|dailyRate|margin|custo/i.test(JSON.stringify(state.page.snapshot)), "o que vai para a página não tem dados internos: " + Object.keys(state.page.snapshot).join(","));

// 2) o cliente pede orçamento, sem login e em aparelho limpo
const client = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const cerrors = [];
client.on("pageerror", (e) => cerrors.push(e.message));
await client.goto(`${base}/p/silva-pinturas-cia`);
await client.getByRole("heading", { name: "Silva Pinturas & Cia" }).waitFor();
check(await client.getByText("Pintura residencial com capricho").isVisible(), "cliente vê a apresentação do pintor");
await client.getByAltText("Foto de Silva Pinturas & Cia").waitFor();
check(true, "cliente vê a foto de perfil");
await client.getByRole("button", { name: /Ampliar foto 1 de 1/ }).click();
await client.getByRole("dialog", { name: "Foto ampliada" }).waitFor();
await client.getByRole("button", { name: "Fechar foto" }).click();
check((await client.getByRole("dialog").count()) === 0, "cliente amplia e fecha a foto do trabalho");
check((await client.getByLabel("E-mail").count()) === 0, "não pede login");
check((await client.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), "noindex");
await client.getByLabel("Seu nome").fill("Maria Souza");
await client.getByLabel(/Seu WhatsApp/).fill("123");
await client.getByRole("button", { name: "Enviar pedido" }).click();
await client.getByText("Confira o nome e o WhatsApp").waitFor();
check(true, "WhatsApp inválido: mensagem clara e nada é enviado");
await client.getByLabel(/Seu WhatsApp/).fill("(11) 98888-7777");
await client.getByLabel(/Endereço ou bairro/).fill("Rua das Flores, 10");
await client.getByLabel(/O que você precisa pintar/).fill("Sala e dois quartos");
await client.getByRole("button", { name: "Enviar pedido" }).click();
await client.getByText("Pedido enviado!").waitFor();
check(state.requests.length === 1 && state.requests[0].phone === "11988887777", "pedido chegou ao servidor");
check(state.posted.at(-1).request.hp === "", "campo escondido (anti-robô) vazio para pessoa de verdade");

// 3) o pintor vê o pedido
await page.goto(base + "/orcamentos");
await page.getByRole("link", { name: /1 pedido novo de clientes/ }).click();
await page.getByText("Maria Souza").waitFor();
check(await page.getByText("(11) 98888-7777").isVisible() && await page.getByText("Sala e dois quartos").isVisible(), "pedido aparece com telefone e mensagem");
await page.getByRole("button", { name: "Criar visita" }).click();
await page.waitForURL(/\/visitas\/[^/]+$/);
await page.getByText("Maria Souza").first().waitFor();
const v = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => { if (!x.startsWith("pintorpro:v1")) return false; try { return Array.isArray(JSON.parse(localStorage.getItem(x)).clients); } catch { return false; } }); const d = JSON.parse(localStorage.getItem(k)); return { clients: d.clients.map((c) => c.name), notes: d.visits[0]?.notes, addr: d.visits[0]?.siteAddress }; });
check(v.clients.includes("Maria Souza") && v.notes.includes("Sala e dois quartos") && v.addr === "Rua das Flores, 10", "cliente e visita criados com o pedido: " + JSON.stringify(v));
check(state.patched.some((p) => p.status === "converted"), "pedido marcado como 'virou visita'");

// 3b) deslizar o pedido para a esquerda descarta (com desfazer)
{
  const cdp = await page.context().newCDPSession(page);
  await page.goto(base + "/pedidos");
  await page.getByText("Maria Souza").waitFor();
  const b = await page.locator("a, div", { hasText: "(11) 98888-7777" }).last().boundingBox();
  const y = b.y + 40, x0 = b.x + b.width / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - (220 * i) / 8, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByText(/Descartado: Maria Souza/).waitFor();
  check(state.patched.at(-1).status === "dismissed", "pedido: deslizar para a esquerda descarta");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await page.waitForTimeout(300);
  check(state.patched.at(-1).status === "converted", "pedido: 'Desfazer' volta ao estado anterior");
}

// 4) desativar: o link deixa de funcionar
await page.goto(base + "/configuracoes");
await page.getByText("Página para receber pedidos").first().click();
await page.getByRole("heading", { name: "Pintura" }).count();
check((await page.getByPlaceholder("Ex.: Pintura residencial com capricho").inputValue()) === "Pintura residencial com capricho", "ao reabrir, a frase publicada continua preenchida");
await page.getByRole("button", { name: "Desativar página" }).click();
await page.getByText("Página desativada").waitFor();
await client.reload();
await client.getByText("Página não encontrada").waitFor();
check(true, "página desativada: o link mostra 'não encontrada'");
console.log(errors.length || cerrors.length ? "ERROS DE CONSOLE: " + [...errors, ...cerrors].join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
