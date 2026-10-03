// Agendar visita, calendário (.ics), painel, lista com busca e filtros.
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT ?? "/tmp";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };

const threeHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
const db = {
  version: 1,
  company: { name: "Silva Pinturas", whatsapp: "(11) 90000-0000", city: "SP", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
  clients: [{ id: "c1", name: "João Pereira", phone: "11 99999-1111", address: "Rua B, 2" }],
  visits: [{ id: "late1", clientId: "c1", siteAddress: "Rua B, 2", notes: "Parede com mofo", photoIds: [], createdAt: threeHoursAgo, scheduledAt: threeHoursAgo }],
};
await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);

// painel: visita atrasada aparece em "Próximas visitas"
await page.goto(base + "/");
await page.getByText("Próximas visitas").waitFor();
check(await page.getByText("João Pereira").isVisible(), "painel lista a visita atrasada em 'Próximas visitas'");

// agendar
await page.getByRole("link", { name: /Agendar visita/ }).click();
await page.getByText("Dia e hora").waitFor();
const dflt = await page.locator('input[type="datetime-local"]').inputValue();
check(/T09:00$/.test(dflt), `data padrão sugerida é amanhã às 9h (${dflt})`);
await page.getByText("Nome", { exact: true }).locator("..").locator("input").fill("Ana Lima");
await page.getByText("Telefone (WhatsApp)").locator("..").locator("input").fill("11 98888-7777");
await page.getByText("Endereço da visita").locator("..").locator("input").fill("Av. Brasil, 5; ap. 3");
await page.getByRole("button", { name: "Agendar", exact: true }).click();
await page.getByText("📅 Visita agendada").waitFor();
check(await page.getByText("Amanhã, 09:00").isVisible(), "visita agendada para 'Amanhã, 09:00'");
const hrefs = await page.locator("a").evaluateAll((as) => as.map((a) => decodeURIComponent(a.getAttribute("href") ?? "")));
check(hrefs.some((h) => h.includes("wa.me/5511988887777") && h.includes("Confirmando nossa visita amanhã, 09:00")), "botão 'Confirmar pelo WhatsApp' com a mensagem pronta");

// calendário
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Adicionar à agenda/ }).click()]);
const ics = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
check(ics.includes("BEGIN:VEVENT") && ics.includes("TRIGGER:-PT1H") && ics.includes("SUMMARY:Visita - Ana Lima") && ics.includes("LOCATION:Av. Brasil\\, 5\; ap. 3"), "arquivo .ics com evento, alarme de 1h, cliente e endereço");
await page.screenshot({ path: `${OUT}/visita-agendada.png` });

// painel mostra as duas; começar a visita tira da lista de próximas
await page.goto(base + "/");
await page.getByText("Próximas visitas").waitFor();
check(await page.getByText("Ana Lima").isVisible(), "painel lista a visita agendada");
await page.getByText("Ana Lima").click();
await page.getByRole("button", { name: /Começar a visita agora/ }).click();
check(!(await page.getByText("📅 Visita agendada").isVisible().catch(() => false)), "ao começar, o aviso de agendamento some");

// lista: filtros e busca
await page.goto(base + "/visitas");
await page.getByRole("tab", { name: /Agendadas/ }).waitFor();
check(await page.getByRole("tab", { name: /Agendadas \(1\)/ }).getAttribute("aria-selected") === "true", "a aba abre em 'Agendadas (1)'");
check(await page.getByRole("tab", { name: /Sem orçamento \(1\)/ }).isVisible(), "aba 'Sem orçamento (1)'");
check(await page.getByRole("tab", { name: /Orçamento feito \(0\)/ }).isVisible(), "aba 'Orçamento feito (0)'");
check(await page.getByText("⏰ Atrasada").isVisible(), "visita atrasada marcada em vermelho");
await page.getByRole("tab", { name: /Sem orçamento/ }).click();
check(await page.getByText("Ana Lima").first().isVisible(), "aba 'Sem orçamento' mostra a visita já começada");
await page.getByRole("tab", { name: /Orçamento feito/ }).click();
check(await page.getByText("Nenhuma visita com orçamento ainda.").isVisible(), "aba vazia avisa");
await page.screenshot({ path: `${OUT}/visitas-lista.png` });

// visita rápida pelo painel
await page.goto(base + "/");
await page.getByRole("button", { name: "GRAVAR VISITA" }).click();
await page.getByText("Salvar visita").first().waitFor();
check(/\/visitas\/[0-9a-f-]{36}$/.test(page.url()), "GRAVAR VISITA abre a visita na hora, sem pedir cliente");

// salvar visita: pede nome/telefone só agora
await page.getByRole("button", { name: "✅ Salvar visita" }).click();
await page.getByRole("heading", { name: "Quem é o cliente?" }).waitFor();
check(await page.getByRole("button", { name: "✅ Salvar visita" }).last().isDisabled(), "sem nome, não deixa salvar");
await page.getByLabel(/Nome do cliente|nome/).last().fill("Marta Souza");
await page.getByLabel("Telefone (WhatsApp)").fill("11988887777");
await page.getByRole("button", { name: "✅ Salvar visita" }).last().click();
await page.waitForURL(/\/visitas$/);
await page.getByRole("tab", { name: /Sem orçamento/ }).click();
check(await page.getByText("Marta Souza").first().isVisible(), "visita salva aparece na lista com o cliente");

// cor do app segue a cor escolhida + logo
await page.goto(base + "/configuracoes");
await page.getByRole("button", { name: "Vermelho" }).or(page.locator("button[aria-pressed]").nth(2)).first().click();
const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim());
check(brand.toLowerCase() === "#b3261e", "cor do app muda para a cor escolhida (" + brand + ")");
await page.setInputFiles('[data-testid="logo-input"]', "tests/logo-teste.png");
await page.getByAltText("Seu logo").waitFor();
check(await page.getByRole("button", { name: "Trocar logo" }).isVisible(), "logo enviado aparece em Ajustes");
console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
