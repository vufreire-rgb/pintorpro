// Convite do Pix depois do primeiro orçamento: o app reconhece o tipo da chave sozinho.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const next = () => page.getByRole("button", { name: /Continuar|Começar/ }).click();
await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(base + "/visitas");
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pintorpro:v1")); d.company.quoteModeAsked = true; localStorage.setItem("pintorpro:v1", JSON.stringify(d)); });
check((await page.getByRole("dialog", { name: "Guia" }).count()) === 0, "nenhum guia abre sozinho no primeiro login");

// cliente e visita já iniciada
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  d.clients = [{ id: "c1", name: "Maria", phone: "11 97777-1111", address: "Rua A, 1" }];
  d.visits = [{ id: "v1", clientId: "c1", siteAddress: "Rua A, 1", notes: "", photoIds: [], createdAt: new Date().toISOString(), startedAt: new Date().toISOString() }];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
});
await page.goto(base + "/orcamentos/novo?visita=v1");
await page.getByLabel("Parede 1 largura").fill("5");
const conf = page.getByRole("button", { name: "Confirmar todos como estão" });
if (await conf.isVisible().catch(() => false)) await conf.click();
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
await page.getByText("Receba a entrada por Pix").waitFor();
check(true, "depois do primeiro orçamento aparece o convite do Pix");
await page.getByLabel(/Sua chave Pix/).fill("123");
check(await page.getByRole("button", { name: "Salvar chave Pix" }).isDisabled(), "chave inválida não deixa salvar");
// 11 números soltos: o app pergunta (CPF ou celular), não adivinha
await page.getByLabel(/Sua chave Pix/).fill("11999991111");
await page.getByText("Esses números são de").waitFor();
check(await page.getByRole("button", { name: "Salvar chave Pix" }).isDisabled(), "11 números soltos: só vale depois de escolher CPF ou celular");
await page.getByRole("button", { name: "Celular", exact: true }).click();
check(await page.getByRole("button", { name: "Salvar chave Pix" }).isEnabled(), "escolhendo 'Celular' a chave vale");
// e-mail: reconhecido sozinho, sem escolher tipo
await page.getByLabel(/Sua chave Pix/).fill("silva@exemplo.com");
await page.getByRole("button", { name: "Salvar chave Pix" }).click();
await page.waitForTimeout(300);
const pix = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).company.pix);
check(pix?.key === "silva@exemplo.com" && pix.type === "email", "chave Pix guardada");

// Ajustes não tem mais o cartão de guias
await page.goto(base + "/configuracoes");
check((await page.getByText("Ver os guias de novo").count()) === 0, "Ajustes não oferece mais guias");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
