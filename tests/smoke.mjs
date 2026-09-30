// Teste de fluxo completo em celular (Chromium headless). Uso: pnpm start & node tests/smoke.mjs
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${process.env.OUT ?? "/tmp"}/${n}.png` });
const next = () => page.getByRole("button", { name: /Continuar|Ir para o painel/ }).click();

await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("João Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.getByPlaceholder("Ex.: Campinas - SP").fill("Campinas - SP"); await next();
await next(); await next(); await next(); await next(); await next(); await next();
await shot("01-onboarding-fim");
await next();
await page.waitForURL(base + "/");
await page.getByText("+ NOVO ORÇAMENTO").waitFor();
await shot("02-painel");

await page.getByText("+ NOVO ORÇAMENTO").click();
await page.getByText("Nome do cliente").locator("..").locator("input").fill("Maria Souza");
await page.getByText("Telefone (WhatsApp)").locator("..").locator("input").fill("11977776666");
await page.getByText("Endereço da obra").locator("..").locator("input").fill("Rua das Flores, 100");
await next();
const roomInputs = page.getByText("Comprim. (m)").locator("..").locator("input");
await page.getByPlaceholder("Ex.: Sala").fill("Sala");
await roomInputs.fill("5");
await page.getByText("Largura (m)").locator("..").locator("input").fill("4");
await page.getByText("+ Adicionar ambiente").click();
await shot("03-ambientes");
await next();
await shot("04-servicos");
await next();
await shot("05-materiais");
await next();
await shot("06-preco");
await next();
await shot("07-revisao");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
await page.getByText("Enviar pelo WhatsApp").waitFor();
await shot("08-detalhe");

// PDF: intercepta o download (sem Web Share no headless) e valida o conteúdo
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.context().on("page", (p) => p.close()), page.getByText("Enviar pelo WhatsApp").click()]);
const path = `${process.env.OUT ?? "/tmp"}/orcamento.pdf`;
await dl.saveAs(path);

await page.getByRole("button", { name: "Fechado" }).click();
await page.goto(base + "/obras");
await page.getByText("Maria Souza").waitFor();
await shot("09-obras");
await page.goto(base);
await shot("10-painel-final");
console.log("ERROS DE CONSOLE:", errors.length ? errors : "nenhum");
console.log("PDF salvo em", path);
await browser.close();
