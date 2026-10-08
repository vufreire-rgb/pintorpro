// Automação: deslizar o orçamento (fechou/perdeu/reabrir + desfazer), perder sozinho e situação da obra automática.
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

const DAY = 86400000;
await page.evaluate((DAY) => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  const iso = (t) => new Date(t).toISOString();
  const q = (id, number, status, validOffsetDays) => ({ id, number, clientId: "c1", siteAddress: "Rua A", status, createdAt: iso(Date.now() - 30 * DAY), validUntil: iso(Date.now() + validOffsetDays * DAY), paymentTerms: "", notes: "", input: { rooms: [], extras: [] }, configSnapshot: {}, engineVersion: "t", result: { totals: { totalCents: 100000 }, schedule: { workDays: 1, totalDays: 1, hours: 8 }, serviceLines: [], materialLines: [], measures: [], extras: [], warnings: [] } });
  const day = (off) => { const t = new Date(Date.now() + off * DAY); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const w = (id, quoteId, o) => ({ id, quoteId, clientId: "c1", title: id, status: "scheduled", createdAt: iso(Date.now()), plannedDays: 1, plannedHours: 8, plannedTotalCents: 100000, plannedCostCents: 0, ...o });
  d.clients = [{ id: "c1", name: "Ana", phone: "", address: "" }, { id: "ci", name: "Cliente Inicio", phone: "", address: "" }, { id: "cf", name: "Cliente Futura", phone: "", address: "" }, { id: "cp", name: "Cliente Paga", phone: "", address: "" }];
  d.quotes = [q("a", 1, "open", 5), q("b", 2, "open", 5), q("old", 3, "open", -20), q("w1", 4, "won", 5), q("w2", 5, "won", 5), q("w3", 6, "won", 5)];
  d.works = [
    w("obra-inicio", "w1", { clientId: "ci", startDate: day(-1) }),
    w("obra-futura", "w2", { clientId: "cf", startDate: day(+5) }),
    w("obra-paga", "w3", { clientId: "cp", status: "in_progress", startDate: day(-5), endDate: day(-1), payments: [{ id: "p", date: day(-3), amountCents: 100000, note: "" }] }),
  ];
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
}, DAY);

// regras automáticas ao abrir o app
await page.goto(base + "/orcamentos");
await page.getByRole("tab", { name: /Perdido/ }).waitFor();
check(/Perdido \(1\)/.test(await page.getByRole("tab", { name: /Perdido/ }).innerText()), "orçamento aberto muito depois da validade vira Perdido sozinho");
await page.getByRole("tab", { name: /Perdido/ }).click();
check(await page.getByText("Sem resposta").isVisible(), "aparece a marca 'Sem resposta'");
await page.goto(base + "/obras");
await page.getByText("Cliente Inicio").waitFor();
const card = async (t) => (await page.locator("a", { hasText: t }).first().innerText()).replace(/\s+/g, " ");
check(/Em andamento/.test(await card("Cliente Inicio")), "obra que chegou na data de início vira 'Em andamento': " + await card("Cliente Inicio"));
check(/Agendada/.test(await card("Cliente Futura")), "obra com início futuro continua 'Agendada'");
check(/Concluída/.test(await card("Cliente Paga")), "tudo pago e término passado: 'Concluída'");

// deslizar o cartão (toque de verdade, pelo protocolo do navegador)
const cdp = await ctx.newCDPSession(page);
const swipe = async (loc, dx) => {
  const b = await loc.boundingBox();
  const y = b.y + b.height / 2, x0 = b.x + b.width / 2, steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / steps, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
await page.goto(base + "/orcamentos");
await page.getByText("Nº 1 · Ana").waitFor();
const tabCount = async (name) => Number(/\((\d+)\)/.exec(await page.getByRole("tab", { name }).innerText())[1]);
check((await tabCount(/Aberto/)) === 2, "2 abertos antes de deslizar");

await swipe(page.locator("a", { hasText: "Nº 1 · Ana" }), 220);
await page.getByText(/Fechou: Ana/).waitFor();
check((await tabCount(/Aberto/)) === 1 && (await tabCount(/Fechado/)) === 4, "deslizar para a direita fecha o orçamento");
let n = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works.length);
check(n === 4, "e cria a obra (4 obras no total)");
await page.getByRole("button", { name: "Desfazer" }).click();
check((await tabCount(/Aberto/)) === 2, "'Desfazer' reabre o orçamento");
n = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works.length);
check(n === 3, "e remove a obra vazia criada");

await swipe(page.locator("a", { hasText: "Nº 2 · Ana" }), -220);
await page.getByText("Marcar como perdido?").waitFor();
await page.getByRole("button", { name: "Cancelar" }).click();
check((await tabCount(/Aberto/)) === 2, "perdeu: o app PERGUNTA primeiro; 'Cancelar' deixa como estava");
await swipe(page.locator("a", { hasText: "Nº 2 · Ana" }), -220);
await page.getByRole("button", { name: "Sim, perdeu" }).click();
await page.getByText(/Perdido: Ana/).waitFor();
check((await tabCount(/Aberto/)) === 1 && (await tabCount(/Perdido/)) === 2, "confirmando, vai para Perdido");

await page.getByRole("tab", { name: /Perdido/ }).click();
await swipe(page.locator("a", { hasText: "Nº 2 · Ana" }), 220);
await page.getByText(/Reaberto: Ana/).waitFor();
check((await tabCount(/Aberto/)) === 2, "deslizar um Perdido para a direita reabre");

// toque normal ainda abre o orçamento
await page.getByRole("tab", { name: /Aberto/ }).click();
await page.locator("a", { hasText: "Nº 1 · Ana" }).click();
await page.waitForURL(/orcamentos\/a$/);
check(await page.getByRole("button", { name: "Fechou! Criar a obra" }).isVisible(), "tocar abre o orçamento, com 'Fechou!' e 'Perdeu' (sem os 3 botões de situação)");
check(!(await page.getByRole("button", { name: "Aberto", exact: true }).isVisible().catch(() => false)), "os botões Aberto/Fechado/Perdido não existem mais");
await page.getByRole("button", { name: "Perdeu" }).click();
await page.getByText("Marcar como perdido?").waitFor();
await page.getByRole("button", { name: "Sim, perdeu" }).click();
await page.getByRole("button", { name: /Reabrir/ }).waitFor();
check(true, "Perdeu → aparece 'Reabrir'");

// obra: botões por ação
await page.goto(base + "/obras");
await page.locator("a", { hasText: "Cliente Inicio" }).click();
await page.getByRole("button", { name: "Tem pendência" }).click();
check(await page.getByText("Pendências").first().isVisible(), "'Tem pendência' marca pendências");
await page.getByRole("button", { name: "Concluir" }).click();
check(await page.getByRole("button", { name: "Reabrir" }).isVisible(), "'Concluir' conclui a obra");
await page.getByRole("button", { name: "Reabrir" }).click();
await page.goto(base + "/obras/obra-paga");
await page.getByRole("button", { name: "Reabrir" }).click();
await page.goto(base + "/obras");
await page.getByText("Cliente Paga").waitFor();
check(/Em andamento/.test(await card("Cliente Paga")), "obra reaberta de propósito não é concluída sozinha de novo: " + await card("Cliente Paga"));

console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
