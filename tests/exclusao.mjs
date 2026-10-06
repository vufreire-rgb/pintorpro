// Exclusão de conta no app, contra um Supabase falso (porta 54321). Precisa do app compilado com
// NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon (ver docs/PLANO_TECNICO.md).
import http from "node:http";
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = { id: "user-1", aud: "authenticated", role: "authenticated", email: "teste@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const calls = { del: [], logout: 0 };
let failNextDelete = true;
let failPush = false;
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  const url = req.url ?? "";
  if (url.startsWith("/auth/v1/token")) return send(200, { access_token: token, refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  if (url.startsWith("/auth/v1/logout")) { calls.logout++; return send(204); }
  if (url.startsWith("/auth/v1/user")) return send(200, user);
  if (url.startsWith("/rest/v1/user_data")) {
    if (req.method === "GET") return send(200, []); // conta nova: nenhuma linha
    return failPush ? send(503, { message: "indisponível" }) : send(201);
  }
  if (url.startsWith("/functions/v1/delete-account")) {
    calls.del.push(req.headers.authorization ?? "");
    if (failNextDelete) { failNextDelete = false; return send(500, { error: "delete_failed" }); }
    return send(200, { ok: true });
  }
  send(404, {});
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe });
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
const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pintorpro:v1")));
check(keysBefore.length > 0, "conta criada e dados guardados no aparelho");

await page.goto(base + "/configuracoes");
await page.getByRole("button", { name: "Excluir minha conta" }).click();
const go = page.getByRole("button", { name: "Excluir para sempre" });
check(await go.isDisabled(), "botão final começa desligado");
await page.getByLabel(/digite EXCLUIR/).fill("excluir");
check(await go.isEnabled(), "digitar EXCLUIR liga o botão");

await go.click();
await page.getByText("Nada foi apagado").waitFor();
check(true, "se o servidor falha, o app avisa que nada foi apagado");
const keysAfterFail = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pintorpro:v1")));
check(keysAfterFail.length > 0, "falha no servidor não apaga os dados do aparelho");

await go.click();
await page.getByText("Sua conta foi excluída").waitFor();
check(true, "depois de excluir, a tela de login avisa que a conta foi excluída");
check(calls.del.length === 2 && calls.del.every((a) => a.startsWith("Bearer ")), "o servidor recebeu o pedido com o token da pessoa");
const keysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pintorpro:v1") || k === "pintorpro:pending-uploads"));
check(keysAfter.length === 0, "dados do aparelho apagados: " + JSON.stringify(keysAfter));
check(await page.getByRole("button", { name: "Entrar", exact: true }).isVisible(), "volta para o login");

// ---- Sair da conta: apaga a cópia local; avisa quando há algo que ainda não foi enviado ----
await page.getByLabel("E-mail").fill("teste@exemplo.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777");
await page.getByRole("button", { name: "Começar" }).click();
await page.waitForURL(base + "/visitas");
await page.goto(base + "/configuracoes");
await page.getByText("Seu negócio").first().waitFor();
failPush = true;                                    // a nuvem "cai"
await page.getByLabel("Nome", { exact: true }).first().fill("Silva Pinturas Novo");
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "Sair", exact: true }).click();
await page.getByText("Há dados que ainda não foram enviados").waitFor();
check(true, "sair com alteração não enviada: o app avisa antes de apagar");
await page.getByRole("button", { name: "Cancelar" }).click();
const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pintorpro:v1")).length);
check(kept > 0, "cancelar mantém os dados no aparelho");
failPush = false;                                   // a nuvem volta
await page.getByRole("button", { name: "Sair", exact: true }).click();
await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pintorpro:v1") || k === "pintorpro:pending-uploads"));
check(left.length === 0, "sair com tudo enviado apaga a cópia local: " + JSON.stringify(left));
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
