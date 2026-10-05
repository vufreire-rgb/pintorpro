// Custos da obra: gastos reais, diária e lucro real x previsto.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const db = {
  version: 1,
  company: { name: "Silva Pinturas", whatsapp: "(11) 90000-0000", city: "SP", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
  services: [], materials: [], enabledServiceIds: [], quotes: [], visits: [], counters: { quote: 0 },
  clients: [{ id: "c1", name: "Carla Dias", phone: "11 97777-1111", address: "Rua C, 3" }],
  works: [{ id: "w1", quoteId: "nope", clientId: "c1", title: "Carla", status: "scheduled", createdAt: new Date().toISOString(), plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 100000 }],
};
await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
await page.goto(base + "/obras/w1");
await page.getByText("Custos e lucro").waitFor();
check(await page.getByText("Lance os gastos").isVisible(), "sem gastos, o app convida a lançar");
await page.getByRole("button", { name: "Material", exact: true }).click();
await page.getByLabel("Valor gasto").fill("400");
await page.getByPlaceholder("Ex.: 2 latas de tinta").fill("tinta");
await page.getByRole("button", { name: "Lançar gasto" }).click();
await page.getByText("Material · tinta").waitFor();
check(await page.getByText("O orçamento ficou").or(page.getByText(/Sobrou (mais|menos)|gastou mais/)).first().isVisible(), "aparece um comentário sobre o orçamento depois do gasto");
check(await page.getByText("Ainda falta receber R$ 3.000,00").isVisible(), "avisa que falta receber");
await page.getByRole("button", { name: "Aumentar" }).first().click();
check(!(await page.getByText("Informe os dias").isVisible().catch(() => false)), "com dias trabalhados a diária real é calculada");
await page.goto(base + "/obras");
await page.getByRole("button", { name: /Ver painel/ }).click();
check(await page.getByText("Lucro real do mês").isVisible(), "painel mostra lucro real do mês");
console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
