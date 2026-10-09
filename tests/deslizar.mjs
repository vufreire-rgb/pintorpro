// Deslizar em Visitas, Obras, Pedidos (sem nuvem: Visitas e Obras) e orçamento fechado por engano.
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

const DAY = 86400000;
await page.evaluate((DAY) => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  const iso = (t) => new Date(t).toISOString();
  const quote = (id, number, status, client) => ({ id, number, clientId: client, siteAddress: "Rua A", status, createdAt: iso(Date.now()), validUntil: iso(Date.now() + 5 * DAY), paymentTerms: "", notes: "", input: { rooms: [], extras: [] }, configSnapshot: {}, engineVersion: "t", result: { totals: { totalCents: 100000 }, schedule: { workDays: 1, totalDays: 1, hours: 8 }, serviceLines: [], materialLines: [], measures: [], extras: [], warnings: [] } });
  const cl = (id, name) => ({ id, name, phone: "", address: "" });
  d.clients = ["Agenda", "Sem Orc", "Com Orc", "Obra Nova", "Obra Dados"].map((n, i) => cl("c" + i, n));
  const vis = (id, client, o) => ({ id, clientId: client, siteAddress: "Rua " + id, notes: "", photoIds: [], createdAt: iso(Date.now() - DAY), ...o });
  d.visits = [
    vis("v-ag", "c0", { scheduledAt: iso(Date.now() + 2 * DAY) }),
    vis("v-sem", "c1", { startedAt: iso(Date.now() - DAY) }),
    vis("v-com", "c2", { startedAt: iso(Date.now() - DAY), quoteId: "q-com" }),
  ];
  d.quotes = [quote("q-com", 1, "open", "c2"), quote("q-nova", 2, "won", "c3"), quote("q-dados", 3, "won", "c4")];
  d.works = [
    { id: "w-nova", quoteId: "q-nova", clientId: "c3", title: "x", status: "scheduled", createdAt: iso(Date.now()), plannedDays: 1, plannedHours: 8, plannedTotalCents: 100000, plannedCostCents: 0 },
    { id: "w-dados", quoteId: "q-dados", clientId: "c4", title: "y", status: "in_progress", createdAt: iso(Date.now()), plannedDays: 1, plannedHours: 8, plannedTotalCents: 100000, plannedCostCents: 0, expenses: [{ id: "e", date: "2026-10-01", kind: "material", amountCents: 100, note: "" }] },
  ];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
}, DAY);

const cdp = await ctx.newCDPSession(page);
const swipe = async (loc, dx) => {
  const b = await loc.boundingBox();
  const y = b.y + b.height / 2, x0 = b.x + b.width / 2, steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / steps, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const tabCount = async (name) => Number(/\((\d+)\)/.exec(await page.getByRole("tab", { name }).innerText())[1]);
const stored = (fn) => page.evaluate(fn);

// ---- Visitas
await page.goto(base + "/visitas");
await page.getByText("Rua v-ag").waitFor();
check(/Agendadas\s*1/.test(await page.getByRole("tab", { name: /Agendadas/ }).innerText()), "abre na aba Agendadas (tem 1)");
await swipe(page.locator("a", { hasText: "Rua v-ag" }), 220);
await page.waitForURL(/visitas\/v-ag$/);
check((await stored(() => !!JSON.parse(localStorage.getItem("pintorpro:v1")).visits.find((v) => v.id === "v-ag").startedAt)), "agendada: deslizar para a direita COMEÇA a visita e abre ela");

await page.goto(base + "/visitas");
await page.getByRole("tab", { name: /A orçar/ }).click();
await swipe(page.locator("a", { hasText: "Rua v-sem" }), 220);
await page.waitForURL(/orcamentos\/novo\?visita=v-sem/);
check(true, "sem orçamento: direita abre o novo orçamento já ligado à visita");

await page.goto(base + "/visitas");
await page.getByRole("tab", { name: /A orçar/ }).click();
await swipe(page.locator("a", { hasText: "Rua v-sem" }), -220);
await page.getByText("Apagar esta visita?").waitFor();
await page.getByRole("button", { name: "Cancelar" }).click();
check(await page.locator("a", { hasText: "Rua v-sem" }).isVisible(), "esquerda PERGUNTA antes de apagar; 'Cancelar' mantém");
await swipe(page.locator("a", { hasText: "Rua v-sem" }), -220);
await page.getByRole("button", { name: "Sim, apagar" }).click();
await page.waitForTimeout(400);
check((await stored(() => JSON.parse(localStorage.getItem("pintorpro:v1")).visits.length)) === 2, "confirmando, a visita é apagada");

await page.getByRole("button", { name: /Visitas com orçamento feito \(1\)/ }).click();
await swipe(page.locator("a", { hasText: "Rua v-com" }), 220);
await page.waitForURL(/orcamentos\/q-com$/);
check(true, "orçamento feito: direita abre o orçamento");

// ---- Obras
await page.goto(base + "/obras");
await page.getByText("Obra Nova").waitFor();
const card = async (t) => (await page.locator("a", { hasText: t }).first().innerText()).replace(/\s+/g, " ");
check(/Agendada/.test(await card("Obra Nova")), "obra nova começa Agendada");
await swipe(page.locator("a", { hasText: "Obra Nova" }), 220);
await page.getByText(/Obra Nova: em andamento/).waitFor();
check(/Em andamento/.test(await card("Obra Nova")), "direita em Agendada: Em andamento");
await page.getByRole("button", { name: "Desfazer" }).click();
check(/Agendada/.test(await card("Obra Nova")), "Desfazer volta para Agendada");
await swipe(page.locator("a", { hasText: "Obra Dados" }), -220);
await page.getByText(/Obra Dados: pendências/).waitFor();
check(/Pendências/.test(await card("Obra Dados")), "esquerda em Em andamento: Pendências");
await swipe(page.locator("a", { hasText: "Obra Dados" }), 220);
await page.getByText(/Obra Dados: concluída/).waitFor();
check((await page.locator("a", { hasText: "Obra Dados" }).count()) === 0, "concluída sai da lista principal");
await page.getByRole("button", { name: /Obras concluídas \(1\)/ }).click();
check(/Concluída/.test(await card("Obra Dados")), "e aparece na aba Obras concluídas");
await page.getByRole("button", { name: "Voltar" }).click();

// ---- Orçamento fechado por engano
await page.goto(base + "/orcamentos");
await page.getByRole("tab", { name: /Fechado/ }).click();
await page.getByText("Obra Nova").waitFor();
await swipe(page.locator("a", { hasText: "Nº 2" }), 220);
await page.getByText(/Voltou a aberto/).waitFor();
check((await tabCount(/Aberto/)) === 2, "fechado por engano: direita volta para Aberto");
check((await stored(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works.some((w) => w.id === "w-nova"))) === false, "e a obra vazia que ele criou some");
await page.getByRole("tab", { name: /Fechado/ }).click();
await swipe(page.locator("a", { hasText: "Nº 3" }), -220);
await page.getByText("Marcar como perdido?").waitFor();
check(await page.getByText(/A obra dele continua em Obras/).isVisible(), "perdeu: avisa que a obra com dados continua");
await page.getByRole("button", { name: "Sim, perdeu" }).click();
await page.getByText(/Perdido: Obra Dados/).waitFor();
check((await tabCount(/Perdido/)) === 1, "confirmando, o fechado vira Perdido");
check((await stored(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works.some((w) => w.id === "w-dados"))) === true, "a obra com gastos NÃO é apagada");

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
