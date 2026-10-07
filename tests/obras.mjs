// Obras: datas, agenda, pagamentos, lista e painel.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
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

await page.goto(base + "/obras");
await page.getByRole("link", { name: /Resultado do mês/ }).waitFor();
check(await page.getByText("Falta receber R$ 3.000,00").isVisible(), "cada obra mostra quanto falta receber");
await page.getByText("Carla Dias").click();
await page.getByText("Dinheiro da obra").waitFor();

// datas
const today = new Date(); const pad = (n) => String(n).padStart(2, "0");
const d = (add) => { const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + add); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
await page.locator('input[type="date"]').first().fill(d(2));
check((await page.locator('input[type="date"]').nth(1).inputValue()) === d(4), "término sugerido = início + 3 dias previstos");
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Adicionar à agenda/ }).click()]);
const ics = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
check(ics.includes("DTSTART;VALUE=DATE:" + d(2).replace(/-/g, "")) && ics.includes("SUMMARY:Obra - Carla Dias"), "arquivo .ics da obra");

// pagamentos
await page.getByRole("button", { name: "Entrada", exact: true }).click();
await page.waitForTimeout(300);
const v1 = await page.getByLabel("Valor recebido (R$)").inputValue(); console.log("valor:", v1); check(/^1[.]?500/.test(v1), "entrada sugerida de 50%");
await page.getByRole("button", { name: "Registrar", exact: true }).click();
check(await page.getByText("Entrada ·").isVisible(), "pagamento registrado na lista");
check(await page.getByText("R$ 1.500,00").first().isVisible(), "recebido e falta atualizam");
await page.getByRole("button", { name: "Pagamento final", exact: true }).click();
await page.waitForTimeout(300);
const v2 = await page.getByLabel("Valor recebido (R$)").inputValue(); console.log("valor:", v2); check(/^1[.]?500/.test(v2), "pagamento final = o que falta");
await page.getByRole("button", { name: "Registrar", exact: true }).click();
check(await page.getByText("Falta").locator("..").getByText("R$ 0,00").isVisible(), "falta zerada");
await page.screenshot({ path: "/tmp/obra.png", fullPage: true });

// lista e painel
await page.goto(base + "/obras");
check(await page.getByText("Tudo recebido").isVisible(), "lista marca 'Tudo recebido'");
check(await page.getByText("Vendido", { exact: true }).isVisible().catch(() => false) === false, "valores não aparecem na lista de obras (ficam na tela Resultado do mês)");
await page.getByRole("link", { name: /Resultado do mês/ }).click();
await page.waitForURL("**/obras/resultado");
check(await page.getByText("Falta receber").first().isVisible() && await page.getByText("Vendido", { exact: true }).isVisible() && await page.getByText("Lucro estimado", { exact: true }).isVisible() && await page.getByText("Em atraso").isVisible(), "Resultado do mês mostra vendido, lucro estimado, falta receber e atraso");

// lembrete de revisão
await page.goto(base + "/configuracoes");
await page.getByText("Lembrete de revisão").first().click();
await page.locator('input[type="time"]').fill("07:30");
await page.getByRole("button", { name: "Todo dia" }).click();
const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Salvar no calendário do celular" }).click()]);
const ics2 = await (await import("node:fs/promises")).readFile(await dl2.path(), "utf8");
check(ics2.includes("RRULE:FREQ=DAILY") && ics2.includes("T073000") && ics2.includes("TRIGGER:PT0S"), "lembrete diário às 07:30 gera .ics com alarme");
check(await page.getByText("Lembrete atual: Todo dia às 07:30").isVisible(), "tela mostra o lembrete salvo");
await page.screenshot({ path: "/tmp/orc.png" });

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
