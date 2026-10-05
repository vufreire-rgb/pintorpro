// Orçamento numa tela só: o ambiente digitado já entra no preço, sem tocar em "Adicionar".
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
const next = () => page.getByRole("button", { name: /Continuar|Ir para o painel/ }).click();
await page.goto(base);
await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next();
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.getByPlaceholder("Ex.: Campinas - SP").fill("Campinas - SP"); await next();
await next(); await next(); await next(); await next(); await next(); await next();
await next();
await page.waitForURL(base + "/visitas");
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  d.clients = [{ id: "c1", name: "Jessica", phone: "11 99999-1111", address: "Rua A, 1" }];
  d.visits = [{ id: "v1", clientId: "c1", siteAddress: "Rua A, 1", notes: "", photoIds: [], createdAt: new Date().toISOString() }];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
});

await page.goto(base + "/orcamentos/novo?visita=v1");
await page.getByText("Primeiro ambiente").waitFor();
const total = page.getByTestId("total");
check((await total.innerText()).trim() === "—", "sem medidas, o preço fica em '—' e o botão desligado");
check(await page.getByRole("button", { name: "Salvar orçamento" }).isDisabled(), "salvar desligado sem ambiente");
await page.getByPlaceholder("Ex.: Sala").fill("Sala");
await page.getByLabel("Parede 1 largura").fill("16");
await page.waitForTimeout(300);
check(/R\$\s?[1-9]/.test(await total.innerText()), "preencheu as medidas: o preço aparece sem tocar em Adicionar (" + (await total.innerText()) + ")");
check(await page.getByRole("button", { name: "Salvar orçamento" }).isEnabled(), "salvar liga sozinho");
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
const q = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).quotes[0]);
check(q.input.rooms.length === 1 && q.input.rooms[0].name === "Sala" && q.input.rooms[0].id !== "pendente", "salvou 1 ambiente (Sala) com id definitivo");

// com um ambiente salvo, o segundo só entra no preço depois de digitar as medidas
await page.getByRole("link", { name: /Editar orçamento/ }).click();
await page.getByText("Editar orçamento nº 1").first().waitFor();
const before = await total.innerText();
await page.getByRole("button", { name: "Adicionar ambiente" }).click();
await page.getByPlaceholder("Ex.: Sala").fill("Quarto");
await page.getByLabel("Parede 1 largura").fill("12");
await page.waitForTimeout(300);
check((await total.innerText()) !== before, "segundo ambiente digitado também aumenta o preço");
await page.getByRole("button", { name: "Salvar", exact: true }).click();
await page.getByText(/rev\. 2/).waitFor();
const q2 = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).quotes[0]);
check(q2.input.rooms.length === 2, "editar e salvar guardou os 2 ambientes");

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
