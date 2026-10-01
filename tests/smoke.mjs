// Teste de fluxo completo em celular (Chromium headless). Uso: pnpm start & node tests/smoke.mjs
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true, permissions: ["microphone"] });
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
await page.getByText("GRAVAR VISITA").waitFor();
await shot("02-painel");

await page.getByText("GRAVAR VISITA").click();
await page.getByText("Nome do cliente").locator("..").locator("input").fill("Maria Souza");
await page.getByText("Telefone (WhatsApp)").locator("..").locator("input").fill("11977776666");
await page.getByText("Endereço da obra").locator("..").locator("input").fill("Rua das Flores, 100");
await page.getByRole("button", { name: "Começar" }).click();
await page.getByText("Fotos (0)").waitFor();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.getByTestId("photo-input").setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: png }, { name: "b.png", mimeType: "image/png", buffer: png }]);
await page.getByText("Fotos (2)").waitFor();
await page.getByRole("button", { name: /Gravar áudio/ }).click();
await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Parar e guardar/ }).click();
await page.getByText("Áudio (1)").waitFor();
await page.getByText(/Áudio 1 ·/).waitFor();
await page.getByPlaceholder(/Sala 4x5/).fill("Sala 4x5, mofo perto da janela");
await shot("03a-visita");
await page.getByRole("link", { name: "Montar orçamento" }).click();
await page.getByText("Suas anotações da visita").waitFor();
await page.getByText("Sala 4x5, mofo perto da janela").waitFor();
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

// ---- Duplicar, editar e apagar ----
const quoteUrl = page.url();
await page.getByRole("button", { name: /Duplicar orçamento/ }).click();
await page.getByText("Orçamento nº 2").waitFor();
await page.getByRole("link", { name: /Editar orçamento/ }).click();
await page.getByText("Editando o orçamento nº 2").waitFor();
await shot("08a-editar");
await page.getByText("Sala", { exact: true }).first().waitFor();       // dados do orçamento vieram preenchidos
for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click(); // até a revisão
await page.getByRole("button", { name: "Salvar alterações" }).click();
await page.getByText(/Orçamento nº 2 · rev\. 2/).waitFor();
await page.getByRole("button", { name: /Apagar orçamento/ }).click();
await shot("08b-confirmar-apagar");
await page.getByRole("button", { name: "Cancelar" }).click();
await page.getByText(/Orçamento nº 2 · rev\. 2/).waitFor();            // cancelar não apaga
await page.getByRole("button", { name: /Apagar orçamento/ }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForURL("**/orcamentos");
await page.getByText("Abertos").or(page.getByText(/Aberto \(1\)/)).first().waitFor();
await page.goto(quoteUrl);                                              // o original continua lá
await page.getByText("Enviar pelo WhatsApp").waitFor();

// PDF: intercepta o download (sem Web Share no headless) e valida o conteúdo
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.context().on("page", (p) => p.close()), page.getByText("Enviar pelo WhatsApp").click()]);
const path = `${process.env.OUT ?? "/tmp"}/orcamento.pdf`;
await dl.saveAs(path);

await page.getByRole("button", { name: "Fechado" }).click();
await page.goto(base + "/obras");
await page.getByText("Maria Souza").waitFor();
await shot("09-obras");
await page.goto(base + "/visitas");
await page.getByText("Orçamento feito").waitFor();
// apagar visita
await page.getByText("Maria Souza").first().click();
await page.getByRole("button", { name: /Apagar visita/ }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForURL("**/visitas");
await page.getByText(/Nenhuma visita ainda/).waitFor();
// cliente com orçamento: bloqueia; depois de apagar orçamento e obra, libera
await page.goto(base + "/clientes");
await page.getByRole("button", { name: "Apagar", exact: true }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.getByText(/Apague-os primeiro/).waitFor();
await page.goto(base + "/obras");
await page.getByRole("button", { name: "Apagar obra" }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.getByText(/Quando você fechar/).waitFor();
await page.goto(quoteUrl);
await page.getByRole("button", { name: /Apagar orçamento/ }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForURL("**/orcamentos");
await page.goto(base + "/clientes");
await page.getByRole("button", { name: "Editar", exact: true }).click();
await page.getByText("Nome", { exact: true }).locator("..").locator("input").fill("Maria Souza Lima");
await page.getByRole("button", { name: "Salvar alterações" }).click();
await page.getByText("Maria Souza Lima").waitFor();
await page.getByRole("button", { name: "Apagar", exact: true }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.getByText("Nenhum cliente ainda.").waitFor();
await page.goto(base);
await shot("10-painel-final");
console.log("ERROS DE CONSOLE:", errors.length ? errors : "nenhum");
console.log("PDF salvo em", path);
await browser.close();
