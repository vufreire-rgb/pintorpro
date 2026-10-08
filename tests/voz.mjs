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
await page.getByRole("button", { name: "Novo orçamento" }).click();
await page.getByRole("link", { name: /Falar/ }).click();
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
check(await page.getByText(/custo estimado .* lucro estimado|dá prejuízo/).isVisible(), "revisão mostra custo e lucro (ou aviso de prejuízo)");
await page.getByLabel(/Preço fechado/).fill("3000");
check((await page.getByTestId("total").textContent())?.replace(/\s/g, "").includes("3.000,00"), "mudar o preço na revisão muda o total");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByText("Dona Maria").first().waitFor();
check(true, "orçamento salvo e aberto");
const total = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("pintorpro:v1")))); return db.quotes[0]?.result.totals.totalCents; });
check(total === 300000, "total salvo = 3000,00 (" + total + ")");
// 3) sem internet: áudio fica guardado e é processado sozinho quando a internet volta
await page.goto(base + "/orcamentos/voz");
await ctx.setOffline(true);
await page.getByRole("button", { name: "Começar a falar" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("Sem internet: áudio guardado no aparelho").waitFor();
check(calls.length === 2, "offline: nada foi enviado");
await page.getByRole("button", { name: "Entendi" }).click();
await page.getByText("Áudios aguardando (1)").waitFor();
check(await page.getByText("esperando internet").isVisible(), "áudio aparece como esperando internet");
await ctx.setOffline(false);
await page.getByText("pronto para conferir").waitFor({ timeout: 15000 });
check(calls.length === 3, "internet voltou: processou sozinho");
const stray = await page.evaluate(async () => { const db = await new Promise((r) => { const q = indexedDB.open("pintorpro-files"); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction("photos").objectStore("photos").getAllKeys(); q.onsuccess = () => r(q.result.filter((k) => String(k).startsWith("voice-")).length); }); });
check(stray === 0, "áudio apagado do aparelho depois de transcrito");
await page.getByRole("button", { name: "Conferir" }).click();
await page.getByText("Confira o que eu entendi").waitFor();
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.waitForTimeout(500);
const left = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:voice-pending") ?? "[]").length);
check(left === 0, "salvar o orçamento limpa a fila");
// 4) só preço, sem medidas: sem custo/lucro/prazo
draft.rooms = [];
draft.closedPriceReais = 1500;
await page.goto(base + "/orcamentos/voz");
await page.getByRole("button", { name: "Começar a falar" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("Só o preço, sem medidas: o app não calcula custo, lucro nem prazo.").waitFor();
check(true, "revisão avisa que só com preço não há custo/lucro");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByText("tem só o preço, sem medidas").waitFor();
check(true, "orçamento só com preço: explica por que não há lucro");
check(!(await page.getByText(/Prazo:/).count()), "orçamento só com preço: não mostra prazo");
// 5) modo simples: medidas ditadas são ignoradas, só o preço
draft.rooms = [{ name: "Sala", lengthM: 4, widthM: 5, heightM: 2.7, wallAreaM2: 0, includeCeiling: true, paint: "acrilica", condition: "pintada", doors: 1, windows: 1 }];
draft.closedPriceReais = 1800;
await page.goto(base + "/configuracoes");
await page.getByText("Como você faz orçamento?").first().click();
await page.getByRole("button", { name: /Só voz e preço fechado/ }).click();
await page.goto(base + "/orcamentos/voz");
await page.getByRole("button", { name: "Começar a falar" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("Confira o que eu entendi").waitFor();
check((await page.getByLabel("O que será feito").inputValue()) === "Pintura: Sala", "modo simples: sugere o que será feito pelos ambientes ditados");
check((await page.getByText("Ambientes", { exact: true }).count()) === 0 && (await page.getByText(/lucro estimado|prejuízo/).count()) === 0, "modo simples: sem ambientes nem lucro na revisão");
check((await page.getByTestId("total").textContent())?.replace(/\s/g, "").includes("1.800,00"), "modo simples: total = preço ditado");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByRole("button", { name: /^Serviços/ }).click();
await page.getByText("Pintura: Sala").first().waitFor();
check((await page.getByText("Só para você").count()) === 0, "modo simples: orçamento sem bloco de custo/lucro");
// 6) ditar de dentro da visita: cliente e endereço da visita, orçamento ligado a ela
await page.goto(base + "/visitas");
await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => { if (!x.startsWith("pintorpro:v1")) return false; try { return Array.isArray(JSON.parse(localStorage.getItem(x)).clients); } catch { return false; } });
  const d = JSON.parse(localStorage.getItem(k));
  d.clients = [{ id: "cv", name: "Seu Carlos", phone: "11 97777-6666", address: "Av. Brasil, 99" }, ...d.clients];
  d.visits = [{ id: "vv", clientId: "cv", siteAddress: "Av. Brasil, 99", notes: "", photoIds: [], createdAt: new Date().toISOString(), startedAt: new Date().toISOString() }, ...d.visits];
  localStorage.setItem(k, JSON.stringify(d));
});
await page.goto(base + "/visitas/vv");
await page.getByRole("link", { name: "Ditar orçamento" }).click();
await page.waitForURL("**/orcamentos/voz?visita=vv");
draft.clientName = "Outro Nome Qualquer";
await page.getByRole("button", { name: "Começar a falar" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Terminei/ }).click();
await page.getByText("Confira o que eu entendi").waitFor();
check(await page.getByText("Seu Carlos").isVisible() && (await page.getByText("Outro Nome Qualquer").count()) === 0, "visita: usa o cliente da visita, não o nome ditado");
check((await page.getByLabel("Endereço da obra").inputValue()) === "Av. Brasil, 99", "visita: endereço da visita");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.waitForTimeout(500);
const linked = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => { if (!x.startsWith("pintorpro:v1")) return false; try { return Array.isArray(JSON.parse(localStorage.getItem(x)).clients); } catch { return false; } }); const d = JSON.parse(localStorage.getItem(k)); const q = d.quotes[0]; return { clientId: q.clientId, visitId: q.visitId, visitQuote: d.visits.find((v) => v.id === "vv")?.quoteId === q.id, clients: d.clients.length }; });
check(linked.clientId === "cv" && linked.visitId === "vv" && linked.visitQuote, "orçamento ligado à visita e ao cliente da visita: " + JSON.stringify(linked));
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
