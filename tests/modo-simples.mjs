// Modo simples ("só voz e preço fechado"): escolha no cadastro, telas de cálculo escondidas, orçamento digitado só com preço, troca em Ajustes.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const next = () => page.getByRole("button", { name: /Continuar|Começar/ }).click();

await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next();
check(await page.getByRole("button", { name: /Com cálculo/ }).getAttribute("aria-pressed") !== "false", "cadastro: 'Com cálculo' vem marcado");
await page.getByRole("button", { name: /Só voz e preço fechado/ }).click();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(base + "/visitas");
const mode = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).company.quoteMode);
check(mode === "simple", "escolha salva: " + mode);

await page.goto(base + "/configuracoes");
await page.getByText("Seu negócio").first().waitFor();
check((await page.getByText("Serviços e preços").count()) === 0 && (await page.getByText("Materiais", { exact: true }).count()) === 0 && (await page.getByText("Avançado: custos e lucro").count()) === 0, "Ajustes: preços, materiais e custos escondidos");

// orçamento digitado só com preço
await page.goto(base + "/orcamentos/novo");
await page.getByLabel("Nome do cliente").fill("Dona Maria");
await page.getByLabel("Endereço da obra").fill("Rua das Flores, 10");
await page.getByLabel("O que será feito").fill("Pintura da sala e dos quartos, tinta inclusa");
check((await page.getByText("Primeiro ambiente").count()) === 0, "sem tela de medidas");
await page.getByLabel("Preço fechado").fill("2800");
check((await page.getByTestId("total").textContent())?.replace(/\s/g, "").includes("2.800,00"), "total = preço digitado");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.getByText("Dona Maria").first().waitFor();
check((await page.getByText("Só para você").count()) === 0, "orçamento: sem bloco de custo/lucro");
check((await page.getByText(/Prazo:/).count()) === 0, "orçamento: sem prazo");
check(await page.getByText("Pintura da sala e dos quartos, tinta inclusa").first().isVisible(), "orçamento mostra o que será feito");
const total = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).quotes[0].result.totals.totalCents);
check(total === 280000, "total salvo 2800,00 (" + total + ")");

// visita: sem o bloco de medidas
await page.goto(base + "/visitas/nova");
await page.getByRole("heading", { name: /Visita/ }).first().waitFor().catch(() => {});
const vid = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pintorpro:v1")); d.visits = [{ id: "v9", siteAddress: "Rua B", notes: "", photoIds: [], createdAt: new Date().toISOString(), startedAt: new Date().toISOString() }]; localStorage.setItem("pintorpro:v1", JSON.stringify(d)); return "v9"; });
await page.goto(base + "/visitas/" + vid);
await page.getByText("Observações").first().waitFor();
check((await page.getByText(/Medidas \(/).count()) === 0, "visita: bloco de medidas escondido no modo simples");
await page.goto(base + "/orcamentos");
await page.getByRole("link", { name: /Nº|Dona Maria/ }).first().click().catch(() => {});

// editar
await page.getByRole("button", { name: /^Mais opções/ }).click();
await page.getByRole("link", { name: "Editar orçamento" }).click();
await page.getByLabel("Preço fechado").fill("3100");
await page.getByRole("button", { name: "Salvar" }).click();
await page.waitForURL(/\/orcamentos\/[^/]+$/);
await page.waitForTimeout(300);
const total2 = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).quotes[0].result.totals.totalCents);
check(total2 === 310000, "editar muda o preço (" + total2 + ")");

// voltar para o cálculo: tudo reaparece
await page.goto(base + "/configuracoes");
await page.getByText("Como você faz orçamento?").first().click();
await page.getByRole("button", { name: /Com cálculo/ }).click();
await page.getByText("Serviços e preços").waitFor();
check(true, "voltando para 'Com cálculo' os preços reaparecem");
await page.goto(base + "/orcamentos/novo");
await page.getByText("Primeiro ambiente").waitFor();
check(true, "voltando para 'Com cálculo' a tela de medidas reaparece");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
