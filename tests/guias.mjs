// Guia da visita (visita de exemplo) e convite para cadastrar a chave Pix depois do primeiro orçamento.
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
const next = () => page.getByRole("button", { name: /Continuar|Fazer meu primeiro orçamento/ }).click();
await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(/orcamentos\/novo\?primeiro=1/);
await page.waitForURL(/orcamentos\/novo\?primeiro=1/);
// primeiro orçamento -> convite do Pix
await page.getByPlaceholder("Nome do cliente").or(page.getByLabel("Nome do cliente")).first().fill("Teste").catch(() => {});
await page.getByLabel("Parede 1 largura").fill("12");
await page.getByRole("button", { name: "Confirmar todos como estão" }).click();
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
await page.getByText("Receba a entrada por Pix").waitFor();
check(true, "depois do primeiro orçamento aparece o convite do Pix");
await page.getByLabel(/Sua chave Pix/).fill("123");
check(await page.getByRole("button", { name: "Salvar chave Pix" }).isDisabled(), "chave inválida não deixa salvar");
await page.getByRole("button", { name: "E-mail", exact: true }).click();
await page.getByLabel(/Sua chave Pix/).fill("silva@exemplo.com");
await page.getByRole("button", { name: "Salvar chave Pix" }).click();
await page.waitForTimeout(300);
const pix = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).company.pix);
check(pix?.key === "silva@exemplo.com" && pix.type === "email", "chave Pix guardada");
check(!(await page.getByText("Receba a entrada por Pix").isVisible().catch(() => false)), "convite some depois de salvar");

// guia da visita
await page.goto(base + "/visitas");
await page.getByText("Treine uma visita").waitFor();
await page.getByRole("button", { name: "Começar o guia" }).click();
await page.getByRole("dialog", { name: "Guia" }).waitFor();
check(await page.getByText("Passo 1 de 5").isVisible(), "o guia abre na visita de exemplo");
await page.getByRole("button", { name: "Próximo" }).click();
await page.getByRole("button", { name: "Próximo" }).click();
check(await page.getByText("Passo 3 de 5").isVisible(), "chegou no passo das medidas");
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByLabel("Parede 1 largura").fill("4");
await page.getByRole("button", { name: "Salvar ambiente" }).click();
await page.getByText("Passo 4 de 5").waitFor();
check(true, "ao salvar a medida o guia avança sozinho");
await page.getByRole("button", { name: "Próximo" }).click();
await page.getByRole("button", { name: "Concluir" }).click();
await page.waitForTimeout(300);
check(!(await page.getByRole("dialog", { name: "Guia" }).isVisible().catch(() => false)), "guia fecha ao concluir");
const tours = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).company.tours);
check(tours?.visita === "done", "guia marcado como visto");
// apagar a visita de exemplo remove o cliente de exemplo
await page.getByRole("button", { name: "Apagar visita" }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForURL(/\/visitas$/);
const left = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pintorpro:v1")); return { v: d.visits.filter((x) => x.isExample).length, c: d.clients.filter((x) => x.isExample).length }; });
check(left.v === 0 && left.c === 0, "apagar a visita de exemplo apaga também o cliente de exemplo");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
