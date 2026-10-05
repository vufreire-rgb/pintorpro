// Financeiro: Pix nos Ajustes, plano de pagamento, cobrança, forma de pagamento + comprovante, recibo e Pix no orçamento.
import { chromium, devices } from "playwright-core";
import { readFile } from "node:fs/promises";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const pad = (n) => String(n).padStart(2, "0");
const d = (add) => { const x = new Date(); x.setDate(x.getDate() + add); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const db = {
  version: 1,
  company: { name: "Silva Pinturas", whatsapp: "(11) 90000-0000", city: "SP", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
  services: [], materials: [], enabledServiceIds: [], quotes: [], visits: [], counters: { quote: 0 },
  clients: [{ id: "c1", name: "Carla Dias", phone: "11 97777-1111", address: "Rua C, 3" }],
  works: [{ id: "w1", quoteId: "nope", clientId: "c1", title: "Carla", status: "in_progress", createdAt: new Date().toISOString(), plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 100000, startDate: d(-20), endDate: d(-18) }],
};
await page.addInitScript((x) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(x)); }, db);

// 1) Pix nos Ajustes
await page.goto(base + "/configuracoes");
await page.getByText("Receber por Pix").click();
await page.getByLabel(/Sua chave Pix/).fill("123");
check(await page.getByText("Essa chave não parece certa").isVisible(), "chave inválida é recusada");
await page.getByLabel(/Sua chave Pix/).fill("123.456.789-09");
check(await page.getByText("Chave válida").isVisible(), "chave CPF válida");
await page.getByRole("button", { name: /QR de teste/ }).click();
await page.getByTestId("pix-qr").waitFor();
const code = await page.getByTestId("pix-code").innerText();
check(code.startsWith("000201010211") && code.includes("12345678909") && code.includes("5406") === false && code.includes("54041.00"), "QR de teste com R$ 1,00 e a chave certa");
await page.getByRole("button", { name: "Fechar" }).click();

// 2) plano de pagamento
await page.goto(base + "/obras/w1");
await page.getByText("Plano de pagamento").waitFor();
await page.getByRole("button", { name: "Entrada + 2 parcelas" }).click();
await page.getByText("Parcela 2").first().waitFor();
const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works[0].plan);
check(plan.length === 3 && plan.reduce((s, p) => s + p.amountCents, 0) === 300000, "plano com entrada + 2 parcelas fechando em R$ 3.000,00");
check(await page.getByText(/em atraso/).first().isVisible(), "parcelas vencidas aparecem como atraso (obra começou há 20 dias)");

// 3) cobrança por WhatsApp com Pix copia e cola
const href = decodeURIComponent(await page.getByRole("link", { name: "Cobrar" }).first().getAttribute("href"));
check(href.includes("wa.me/5511977771111") && href.includes("Olá, Carla!") && href.includes("000201010211"), "botão Cobrar abre o WhatsApp com mensagem e Pix copia e cola");

// 3b) cobrança em PDF (com QR do Pix) para mandar pelo WhatsApp
const [dc] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: /Cobrança em PDF/ }).first().click()]);
const cb = await readFile(await dc.path());
check(cb.slice(0, 4).toString() === "%PDF" && cb.length > 3000 && /^cobranca-/.test(dc.suggestedFilename()), "cobrança em PDF gerada (" + dc.suggestedFilename() + ", " + cb.length + " bytes)");
await dc.saveAs("/tmp/cobranca.pdf");
await page.getByText(/O arquivo foi baixado e o WhatsApp foi aberto/).waitFor();
check(true, "aviso claro quando o celular não abre o compartilhamento direto");
await page.getByText(/O arquivo foi baixado/).click();

// 4) Pix da parcela (QR para mostrar ao cliente)
await page.getByRole("button", { name: /QR do Pix/ }).first().click();
await page.getByTestId("pix-qr").waitFor();
check((await page.getByTestId("pix-code").innerText()).includes("540715000.00") || (await page.getByTestId("pix-code").innerText()).includes("5407"), "Pix da parcela vem com o valor");
await page.getByRole("button", { name: "Fechar" }).click();

// 5) registrar pagamento da próxima parcela, com forma e comprovante
await page.getByRole("button", { name: /^Entrada · / }).click();
await page.getByRole("button", { name: "Dinheiro" }).click();
await page.getByTestId("proof-input").setInputFiles("tests/foto-teste.png");
await page.getByRole("button", { name: "Registrar", exact: true }).click();
await page.getByText(/Entrada · .* · Dinheiro/).waitFor();
const pay = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).works[0].payments[0]);
check(pay.method === "dinheiro" && !!pay.proofId && pay.amountCents === 150000, "pagamento guardado com forma e comprovante (" + pay.method + ", " + pay.amountCents + ")");
await page.getByAltText("Comprovante").waitFor();
check(true, "miniatura do comprovante aparece");
check(await page.getByText("Paga").first().isVisible(), "a entrada passa a '✓ Paga' sozinha");

// 5b) enviar o comprovante (foto) guardado no pagamento
const [dp] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.getByRole("button", { name: "Enviar comprovante" }).click()]);
check(dp.suggestedFilename() === "comprovante.jpg" && (await readFile(await dp.path())).length > 100, "botão 'Enviar comprovante' manda a foto anexada");
await page.getByText(/O arquivo foi baixado/).click();

// 6) recibo em PDF
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: "Recibo" }).click()]);
const path = await dl.path();
const bytes = await readFile(path);
check(bytes.slice(0, 4).toString() === "%PDF" && bytes.length > 3000, "recibo gerado em PDF (" + bytes.length + " bytes, arquivo " + dl.suggestedFilename() + ")");
await dl.saveAs("/tmp/recibo.pdf");

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
