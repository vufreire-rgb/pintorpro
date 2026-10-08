// Navegação com aba atual, "Salvar visita" fixo, medidas recolhidas, Ajustes em blocos e listas sem ruído.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
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
await page.goto(base + "/visitas");
const now = Date.now();
await page.evaluate((now) => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  d.clients = [{ id: "c1", name: "Jessica Lima", phone: "11 99999-1111", address: "" }];
  d.visits = [{ id: "v1", clientId: "c1", siteAddress: "Rua A, 1", notes: "", photoIds: [], createdAt: new Date(now - 86400000).toISOString(), startedAt: new Date(now - 86400000).toISOString() }];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
}, now);

// menu: aba atual destacada
await page.goto(base + "/visitas");
const cur = async () => page.locator('nav a[aria-current="page"]').allInnerTexts();
check((await cur()).join() === "Visitas", "menu destaca 'Visitas' na tela de visitas");
await page.getByRole("link", { name: "Obras" }).click();
await page.waitForURL("**/obras");
check((await cur()).join() === "Obras", "menu destaca 'Obras' ao trocar de aba");
await page.goto(base + "/visitas/v1");
check((await page.locator('nav a[aria-current="page"]').count()) === 0, "dentro de uma visita não há menu (tela de trabalho)");

// lista sem ruído: abre a aba "Sem orçamento" e confere o card
await page.goto(base + "/visitas");
await page.getByRole("tab", { name: /A orçar/ }).click();
// topo com o pintor e abertura
check(await page.getByRole("link", { name: "Silva Pinturas · Ajustes" }).isVisible(), "topo de Visitas tem o logo pequeno do pintor (leva a Ajustes)");
check((await page.getByTestId("brand-name").count()) === 0, "Visitas não gasta uma linha com o nome e a saudação");

const card = await page.locator("a[href='/visitas/v1']").innerText();
check(!/0 foto|0 áudio|\(s\)/.test(card), "card sem '0 foto(s)' nem '(s)': " + JSON.stringify(card.replace(/\n/g, " | ")));

// visita: salvar fixo + medidas recolhidas
await page.goto(base + "/visitas/v1");
await page.getByText("Nenhuma foto", { exact: true }).waitFor();
check(!(await page.getByPlaceholder("Ex.: Sala").isVisible()), "formulário de medidas começa recolhido");
const save = page.getByRole("button", { name: "Salvar visita" });
const box = await save.boundingBox();
const vh = page.viewportSize().height;
check(box && box.y + box.height > vh - 120, "'Salvar visita' fica fixo na parte de baixo da tela mesmo sem rolar");
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByPlaceholder("Ex.: Sala").waitFor();
check(await page.getByPlaceholder("Ex.: Sala").isVisible(), "tocar no botão abre o formulário de medidas");

// ajustes em blocos
await page.goto(base + "/configuracoes");
await page.getByText("Seu negócio").first().waitFor();
const h = await page.evaluate(() => document.documentElement.scrollHeight);
check(h < 2200, "Ajustes ficou curto (" + h + " px de altura, antes eram ~7.000 px no celular)");
check(!(await page.locator('input[value="Silva Pinturas"]').isVisible().catch(() => false)), "todas as linhas de Ajustes começam fechadas (lista limpa)");
await page.getByText("Seu negócio").first().click();
check(await page.locator('input[value="Silva Pinturas"]').isVisible(), "tocar em 'Seu negócio' abre os campos");
check(!(await page.getByText("Valor de exemplo — confira").first().isVisible().catch(() => false)), "serviços começam recolhidos");
await page.getByText("Serviços e preços").click();
check(await page.getByText("Valor de exemplo — confira").first().isVisible(), "tocar em 'Serviços e preços' abre o bloco");

// nada passa da largura da tela (em 390 e 412 px), com todos os blocos abertos
for (const w of [360, 390]) {
  await page.setViewportSize({ width: w, height: 800 });
  for (const u of ["/visitas", "/visitas/v1", "/orcamentos", "/orcamentos/novo?visita=v1", "/obras", "/configuracoes", "/clientes"]) {
    await page.goto(base + u);
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const over = await page.evaluate(() => { const cw = document.documentElement.clientWidth; return [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > cw + 1 && !e.closest("[data-allow-scroll]") && getComputedStyle(e).overflowX === "visible").slice(0, 3).map((e) => e.tagName + ":" + (e.textContent || "").slice(0, 30)); });
    check(over.length === 0, `sem estouro de largura em ${u} (${w}px)` + (over.length ? " → " + JSON.stringify(over) : ""));
  }
}

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
