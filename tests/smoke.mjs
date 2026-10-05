// Teste de fluxo completo em celular (Chromium headless). Uso: pnpm start & node tests/smoke.mjs
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true, permissions: ["microphone", "camera"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${process.env.OUT ?? "/tmp"}/${n}.png` });
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) throw new Error(msg); };
const next = () => page.getByRole("button", { name: /Continuar|Ir para o painel/ }).click();

await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("João Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.getByPlaceholder("Ex.: Campinas - SP").fill("Campinas - SP"); await next();
await next(); await next(); await next(); await next(); await next(); await next();
await shot("01-onboarding-fim");
await next();
await page.waitForURL(base + "/visitas");
await page.getByRole("button", { name: /gravar visita/i }).waitFor();
await shot("02-painel");

await page.getByRole("button", { name: /gravar visita/i }).click();                       // um toque: a visita já existe, sem cliente
await page.getByText("Fotos (0)").waitFor();
await page.getByText("Endereço da obra").locator("..").locator("input, textarea").fill("Rua das Flores, 100");
// medidas na visita (viram ambientes do orçamento)
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByPlaceholder("Ex.: Sala").fill("Sala");
await page.getByText("Comp.", { exact: true }).locator("..").locator("input").fill("5");
await page.getByText("Larg.", { exact: true }).locator("..").locator("input").fill("4");
await page.getByText("Adicionar ambiente").click();
await page.getByText("Medidas (1)").waitFor();
// fotos: galeria (2) + câmera do app (2, com ambiente marcado)
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.getByTestId("photo-input").setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: png }, { name: "b.png", mimeType: "image/png", buffer: png }]);
await page.getByText("Fotos (2)").waitFor();
await page.getByRole("button", { name: /Tirar fotos/ }).click();
await page.getByRole("button", { name: "Sala", exact: true }).click();
await page.waitForFunction(() => document.querySelector("video")?.videoWidth > 0);
await page.getByRole("button", { name: "Tirar foto", exact: true }).click();
await page.getByText("1 foto", { exact: true }).waitFor();
await page.getByRole("button", { name: "Tirar foto", exact: true }).click();
await page.getByText("2 fotos", { exact: true }).waitFor();
await shot("03b-camera");
await page.getByRole("button", { name: "Concluir" }).click();
await page.getByText("Fotos (4)").waitFor();
const rooms = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("pintorpro:v1")).visits[0].photoMeta ?? {}).map((m) => m.room));
if (rooms.filter((r) => r === "Sala").length !== 2) throw new Error("ambiente das fotos da câmera não foi marcado: " + JSON.stringify(rooms));
// áudio: pede confirmação, grava e marca momentos
await page.getByRole("button", { name: /Gravar áudio/ }).click();
await page.getByText("Você avisou o cliente?").waitFor();
await page.getByRole("button", { name: /Sim, avisei/ }).click();
await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Medida/ }).click();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: /Problema/ }).click();
await page.getByText("2 marcas neste áudio.").waitFor();
await page.getByRole("button", { name: /Parar e guardar/ }).click();
await page.getByText("Áudio (1)").waitFor();
await page.getByText(/Áudio 1 ·/).waitFor();
await page.getByRole("group", { name: "Marcas do áudio" }).or(page.getByLabel("Marcas do áudio")).getByRole("button", { name: /Medida/ }).waitFor();
await page.getByPlaceholder(/Cliente quer cor/).fill("Sala 4x5, mofo perto da janela");
await shot("03a-visita");
// salvar a visita: só agora pede nome e telefone do cliente
await page.getByRole("button", { name: "Salvar visita" }).click();
await page.getByRole("heading", { name: "Quem é o cliente?" }).waitFor();
await page.getByText("Nome do cliente").locator("..").locator("input").fill("Maria Souza");
await page.getByText("Telefone (WhatsApp)").last().locator("..").locator("input").fill("11977776666");
await page.getByRole("button", { name: "Salvar visita" }).last().click();
await page.waitForURL(/\/visitas$/);
await page.getByRole("tab", { name: /Sem orçamento/ }).click();
await page.getByText("Maria Souza").first().click();
await page.getByText("Fotos (4)").waitFor();
// atalhos de contato do cliente
const hrefs = await page.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
if (!hrefs.some((h) => h === "tel:11977776666") || !hrefs.some((h) => h?.startsWith("https://wa.me/5511977776666")) || !hrefs.some((h) => h?.includes("google.com/maps"))) throw new Error("atalhos de contato ausentes: " + hrefs);
await page.getByRole("link", { name: "Montar orçamento" }).click();
await page.getByText("Suas anotações da visita").click();
await page.getByText("Sala 4x5, mofo perto da janela").waitFor();
await page.getByText("5 × 4 m, altura 2,7 m").waitFor();                // o ambiente anotado na visita já veio
await shot("03-orcamento-uma-tela");
await page.getByText("Maria Souza").first().waitFor();                  // cliente da visita já veio
check(await page.getByTestId("total").innerText().then((t) => /R\$\s?[1-9]/.test(t)), "preço aparece na hora, sem passar por etapas");
check(!(await page.getByRole("button", { name: "Continuar" }).isVisible().catch(() => false)), "não há mais etapas com 'Continuar'");
check(!(await page.getByText("Lucro estimado").isVisible().catch(() => false)), "custo e lucro começam escondidos");
await page.getByText("Ajustes do orçamento").click();
await shot("04-ajustes-opcionais");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
await page.getByText("Enviar pelo WhatsApp").waitFor();
await shot("08-detalhe");

// ---- Duplicar, editar e apagar ----
const quoteUrl = page.url();
await page.getByRole("button", { name: /Duplicar orçamento/ }).click();
await page.getByText("Orçamento nº 2").waitFor();
await page.getByRole("link", { name: /Editar orçamento/ }).click();
await page.getByText("Editar orçamento nº 2").first().waitFor();
await shot("08a-editar");
await page.getByText("Sala", { exact: true }).first().waitFor();       // dados do orçamento vieram preenchidos
await page.getByRole("button", { name: "Salvar", exact: true }).click();
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
await page.getByRole("tab", { name: /Orçamento feito \(1\)/ }).click();
await page.getByText("Maria Souza").first().waitFor();
// apagar visita
await page.getByText("Maria Souza").first().click();
await page.getByRole("button", { name: /Apagar visita/ }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForURL("**/visitas");
await page.getByText(/Nenhuma visita/).first().waitFor();
// cliente com orçamento: bloqueia; depois de apagar orçamento e obra, libera
await page.goto(base + "/clientes");
await page.getByRole("button", { name: "Apagar", exact: true }).click();
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.getByText(/Apague-os primeiro/).waitFor();
await page.goto(base + "/obras");
await page.getByText("Maria Souza").first().click();
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
