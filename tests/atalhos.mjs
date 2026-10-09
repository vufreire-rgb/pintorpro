// Atalhos nas medidas: ambiente retangular (3 medidas) e duplicar ambiente, na visita e no orçamento.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
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
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(base + "/visitas");
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  d.company.quoteModeAsked = true;
  d.clients = [{ id: "c1", name: "Jessica", phone: "11 99999-1111", address: "Rua A, 1" }];
  d.visits = [{ id: "v1", clientId: "c1", siteAddress: "Rua A, 1", notes: "", photoIds: [], createdAt: new Date().toISOString() }];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
});

await page.goto(base + "/visitas/v1");
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByPlaceholder("Ex.: Sala").fill("Sala");
check(await page.getByText("Atalho: ambiente retangular").isVisible(), "ambiente em branco oferece o atalho retangular");
await page.getByText("Atalho: ambiente retangular").click();
check(await page.getByRole("button", { name: "Preencher paredes e teto" }).isDisabled(), "o atalho só liga com as 3 medidas");
await page.getByLabel("Atalho comprimento").fill("5");
await page.getByLabel("Atalho largura").fill("4");
await page.getByRole("button", { name: "Preencher paredes e teto" }).click();
check(await page.getByTestId("surface").count() === 5, "3 medidas viram 4 paredes + teto (5 superfícies)");
check(await page.getByLabel("Parede 1 largura").inputValue() === "5" && await page.getByLabel("Parede 2 largura").inputValue() === "4", "paredes opostas têm o comprimento e a largura certos");
check(!(await page.getByText("Atalho: ambiente retangular").isVisible().catch(() => false)), "o atalho some depois de usado");
await page.getByRole("button", { name: "Salvar ambiente" }).click();
await page.getByRole("button", { name: /^Medidas.*m²/ }).waitFor();

// duplicar na visita
await page.getByRole("button", { name: "Duplicar Sala" }).click();
await page.getByRole("button", { name: /^Medidas.*2 ambientes/ }).waitFor();
check(await page.getByText("Sala (cópia)").isVisible(), "duplicar na visita cria 'Sala (cópia)'");

// duplicar no orçamento
await page.goto(base + "/orcamentos/novo?visita=v1");
await page.getByRole("button", { name: /Sala\d/ }).first().click();
await page.getByRole("button", { name: "Duplicar ambiente" }).first().click();
await page.getByRole("button", { name: /Sala \(cópia\)/ }).first().waitFor();
check((await page.getByRole("button", { name: /m² · \d+ serviço/ }).count()) >= 3, "duplicar no orçamento acrescenta mais um ambiente");
check(errors.length === 0, "sem erros de console: " + errors.join(" | "));
await browser.close();
if (fails.length) { console.log("\nFALHARAM:", fails.length); process.exit(1); }
console.log("\nTudo certo.");
