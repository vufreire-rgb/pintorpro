// Guias passo a passo: primeiro login -> Visitas -> visita -> orçamento -> Obras -> obra -> Ajustes, e Pix.
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
await page.goto(base);
const next = () => page.getByRole("button", { name: /Continuar|Começar/ }).click();
const step = async (n, total, msg) => { await page.getByText(`Passo ${n} de ${total}`).waitFor(); check(true, msg); };
const tap = (name) => page.getByRole("dialog", { name: "Guia" }).getByRole("button", { name }).click();
await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(base + "/visitas");

// 1) guia da lista de Visitas abre sozinho no primeiro login
await step(1, 3, "primeiro login cai em Visitas com o guia aberto");
await tap("Próximo"); await tap("Próximo");
await step(3, 3, "guia de Visitas chega ao último passo");
await tap("Abrir visita de exemplo");

// 2) guia da visita
await step(1, 5, "abre a visita de exemplo com o guia da visita");
await tap("Próximo"); await tap("Próximo");
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByLabel("Parede 1 largura").fill("12");
await page.getByRole("button", { name: "Salvar ambiente" }).click();
await step(4, 5, "salvar a medida avança o guia sozinho");
await tap("Próximo");
await tap("Ir para o orçamento");

// 3) guia do orçamento
await page.waitForURL(/orcamentos\/novo\?visita=/);
await step(1, 5, "guia do orçamento abre ao chegar da visita");
await page.getByText(/Paredes \d/).first().waitFor();
check(true, "o orçamento já veio com as medidas da visita");
await tap("Próximo"); await tap("Próximo"); await tap("Próximo"); await tap("Próximo");
await step(5, 5, "último passo do orçamento (barra de preço) fica visível");
await tap("Concluir");
await page.waitForTimeout(300);
check(!(await page.getByRole("dialog", { name: "Guia" }).isVisible().catch(() => false)), "guia do orçamento fecha");

// 4) guia de Obras
await page.goto(base + "/obras");
await step(1, 2, "guia de Obras abre sozinho");
await tap("Próximo");
await tap("Abrir obra de exemplo");
await step(1, 4, "abre a obra de exemplo com o guia da obra");
await tap("Próximo"); await tap("Próximo"); await tap("Próximo");
await tap("Concluir");
await page.waitForURL(base + "/obras");
await page.getByText("Exemplo", { exact: true }).first().waitFor();
check(true, "obra de exemplo aparece marcada na lista");
const pn = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works.filter((w) => w.isExample).length);
check(pn === 1, "obra de exemplo guardada");

// 5) guia de Ajustes
await page.goto(base + "/configuracoes");
await step(1, 5, "guia de Ajustes abre sozinho");
await tap("Próximo"); await tap("Próximo"); await tap("Próximo"); await tap("Próximo");
await tap("Concluir");
const tours = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).company.tours);
check(["visitas", "visita", "orcamento", "obras", "obra", "ajustes"].every((k) => tours[k] === "done"), "os 6 guias ficaram marcados como vistos: " + JSON.stringify(tours));

// rever os guias
await page.getByRole("button", { name: "Ver os guias de novo" }).click();
await page.waitForURL(base + "/visitas");
await step(1, 3, "'Ver os guias de novo' abre o guia de Visitas outra vez");
await tap("Pular");

// Pix depois do primeiro orçamento
await page.goto(base + "/orcamentos/novo?visita=" + (await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).visits[0].id)));
await page.getByText(/Paredes \d/).first().waitFor();
await page.getByPlaceholder("Nome do cliente").or(page.getByLabel("Nome do cliente")).first().fill("Maria").catch(() => {});
await page.evaluate(() => localStorage.setItem("pintorpro:no-tours", "1"));
await page.reload();
await page.getByText(/Paredes \d/).first().waitFor();
const conf = page.getByRole("button", { name: "Confirmar todos como estão" });
if (await conf.isVisible().catch(() => false)) await conf.click();
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
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
