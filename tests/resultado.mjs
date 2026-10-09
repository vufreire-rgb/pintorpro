// Resultado do mês: vendido, recebido, gastos e o que sobrou no caixa.
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
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next();
await page.waitForURL(base + "/visitas");
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pintorpro:v1")); d.company.quoteModeAsked = true; localStorage.setItem("pintorpro:v1", JSON.stringify(d)); });
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const q = (id, total) => ({ id, number: 1, clientId: "c1", siteAddress: "", status: "won", createdAt: now.toISOString(), closedAt: now.toISOString(), validUntil: now.toISOString(), paymentTerms: "", notes: "", input: { rooms: [], extras: [] }, configSnapshot: {}, engineVersion: "t", result: { totals: { totalCents: total }, schedule: { workDays: 0, totalDays: 0, hours: 0 }, serviceLines: [], materialLines: [], measures: [], extras: [], warnings: [] } });
  d.clients = [{ id: "c1", name: "Ana", phone: "", address: "" }];
  d.quotes = [q("q1", 300000)];
  d.works = [{ id: "w1", quoteId: "q1", clientId: "c1", title: "Obra", status: "in_progress", createdAt: now.toISOString(), plannedDays: 1, plannedHours: 8, plannedTotalCents: 300000, plannedCostCents: 0,
    payments: [{ id: "p1", date: ym + "-02", amountCents: 100000, note: "" }], expenses: [{ id: "e1", date: ym + "-03", kind: "material", amountCents: 30000, note: "" }] }];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
});
await page.goto(base + "/obras");
await page.getByRole("link", { name: "Resultado do mês" }).click();
await page.waitForURL("**/obras/resultado");
const money = async (id) => (await page.getByTestId(id).textContent()).replace(/\s/g, "");
check((await money("r-vendido")).includes("3.000,00"), "vendido: " + await money("r-vendido"));
check((await money("r-recebido")).includes("1.000,00"), "recebido: " + await money("r-recebido"));
check((await money("r-gastos")).includes("300,00"), "gastos: " + await money("r-gastos"));
check((await money("sobrou")).includes("700,00"), "sobrou no caixa: " + await money("sobrou"));
check((await money("r-falta")).includes("2.000,00"), "falta receber: " + await money("r-falta"));
check(await page.getByRole("button", { name: "Próximo mês" }).isDisabled(), "não avança para o futuro");
await page.getByRole("button", { name: "Mês anterior" }).click();
check((await money("sobrou")).includes("0,00") && !(await money("sobrou")).includes("700"), "mês anterior vazio");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
