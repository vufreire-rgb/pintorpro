// Esqueci a senha, link vencido, nova senha e confirmação de e-mail (reenvio), contra um Supabase falso (porta 54321).
// Precisa do app compilado com NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon.
import http from "node:http";
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = { id: "user-1", aud: "authenticated", role: "authenticated", email: "ana@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const seen = { recover: [], resend: [], signup: [], put: [] };
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204);
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = req.url ?? ""; const body = raw ? JSON.parse(raw) : {};
    if (url.startsWith("/auth/v1/token")) return send(400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
    if (url.startsWith("/auth/v1/signup")) { seen.signup.push({ url, body }); return send(200, user); }
    if (url.startsWith("/auth/v1/resend")) { seen.resend.push(body); return send(200, {}); }
    if (url.startsWith("/auth/v1/recover")) { seen.recover.push({ url, body }); return send(200, {}); }
    if (url.startsWith("/auth/v1/user")) { if (req.method === "PUT") seen.put.push(body); return send(200, user); }
    if (url.startsWith("/auth/v1/logout")) return send(204);
    if (url.startsWith("/rest/v1/user_data")) return req.method === "GET" ? send(200, []) : send(201);
    send(404, {});
  });
});
await new Promise((r) => server.listen(54321, r));

const browser = await chromium.launch({ executablePath: exe });
const newPage = async () => { const ctx = await browser.newContext({ ...devices["Pixel 7"] }); await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1")); return ctx.newPage(); };
const errors = [];

// 1) conta não confirmada: avisa e reenvia
let page = await newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.getByLabel("E-mail").fill("ana@exemplo.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.getByText("Falta confirmar seu e-mail").waitFor();
check(true, "login de e-mail não confirmado: o app explica o que fazer");
await page.getByRole("button", { name: "Reenviar e-mail de confirmação" }).click();
await page.getByText("Enviamos o e-mail de novo").waitFor();
check(seen.resend.length === 1 && seen.resend[0].email === "ana@exemplo.com" && seen.resend[0].type === "signup", "reenviou o e-mail de confirmação");

// 2) criar conta com confirmação ligada
await page.getByRole("button", { name: "Não tenho conta — criar" }).click();
await page.getByLabel("E-mail").fill("bia@exemplo.com");
await page.getByLabel("Senha").fill("123456");
await page.getByRole("button", { name: "Criar conta" }).click();
await page.getByText("Enviamos um e-mail para confirmar sua conta").waitFor();
check(seen.signup.length === 1 && /redirect_to=/.test(seen.signup[0].url) && decodeURIComponent(seen.signup[0].url).includes(base), "cadastro pede que o link do e-mail volte para o app");

// 3) esqueci minha senha
page = await newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.getByRole("button", { name: "Esqueci minha senha" }).click();
check(!(await page.getByLabel("Senha").isVisible().catch(() => false)), "na tela de recuperação não pede senha");
await page.getByLabel("E-mail").fill("ana@exemplo.com");
await page.getByRole("button", { name: "Enviar link" }).click();
await page.getByText("Se esse e-mail tiver uma conta").waitFor();
const rec = seen.recover[0];
check(rec && rec.body.email === "ana@exemplo.com" && decodeURIComponent(rec.url).includes(base + "/redefinir-senha"), "pediu o link com destino /redefinir-senha");

// 4) clicou no link do e-mail: escolhe a senha nova
page = await newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/redefinir-senha#access_token=${token}&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery`);
const fields = page.locator('input[autocomplete="new-password"]');
await fields.first().waitFor();
check(true, "link válido abre o formulário de nova senha");
await fields.nth(0).fill("segredo1");
await fields.nth(1).fill("segredo2");
check(await page.getByText("As senhas não são iguais").isVisible(), "avisa quando as senhas são diferentes");
check(await page.getByRole("button", { name: "Salvar nova senha" }).isDisabled(), "não salva com senhas diferentes");
await fields.nth(1).fill("segredo1");
await page.getByRole("button", { name: "Salvar nova senha" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/redefinir-senha"));
check(seen.put.length === 1 && seen.put[0].password === "segredo1", "gravou a senha nova e saiu da página");

// 5) link vencido e acesso direto
page = await newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/redefinir-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
await page.getByText("Este link venceu").waitFor();
check(true, "link vencido: explica e manda pedir outro");
page = await newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/redefinir-senha`);
await page.getByText("Este link venceu").waitFor({ timeout: 10000 });
check(true, "abrir a página sem o link também explica");

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close(); server.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
