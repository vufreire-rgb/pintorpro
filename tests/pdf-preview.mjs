// Gera o PDF do orçamento pelo app (fotos, 2 ambientes) e salva em OUT/pdf-<nome>.pdf para conferir contra o desenho do designer.
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT ?? "/tmp";
const browser = await chromium.launch({ executablePath: exe });

async function gerar({ nome, cor, comValores, comLink, materiais = false }) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const db = {
    version: 1,
    company: { name: "Silva Pinturas", ownerName: "Carlos Silva", whatsapp: "(11) 90000-0000", city: "São Paulo, SP", paymentTerms: "50% na entrada e 50% na entrega", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price", brandColor: cor, depositPct: 50 },
    clients: [{ id: "c1", name: "Maria Souza", phone: "", address: "" }],
    visits: [{ id: "v1", clientId: "c1", siteAddress: "Rua das Flores, 120, ap. 32", notes: "", photoIds: [], createdAt: new Date().toISOString() }],
  };
  await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);

  // visita: 3 fotos, todas "No PDF", com ambiente e legenda
  await page.goto(base + "/visitas/v1");
  await page.getByTestId("photo-input").setInputFiles(["tests/foto-teste.png", "tests/foto-teste.png", "tests/foto-teste.png"]);
  await page.getByText("3 fotos", { exact: true }).waitFor();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Pôr no PDF" }).first().click();
  const salas = ["Sala", "Sala", "Quarto"], legs = ["Rachadura perto da janela", "Tinta descascando", "Canto do teto com mofo"];
  for (let i = 0; i < 3; i++) {
    await page.getByPlaceholder(`Foto ${i + 1}: ambiente`).fill(salas[i]);
    await page.getByPlaceholder("Legenda").nth(i).fill(legs[i]);
  }

  // orçamento: 2 ambientes
  await page.getByRole("link", { name: "Montar orçamento" }).click();
  await page.getByLabel("Parede 1 largura").waitFor();
  const room = async (n, c, l) => {
    if (!(await page.getByPlaceholder("Ex.: Sala").isVisible())) await page.getByRole("button", { name: "Adicionar ambiente" }).click();
    await page.getByPlaceholder("Ex.: Sala").fill(n);
    await page.getByLabel("Parede 1 largura").fill(String(2 * (Number(c) + Number(l.replace(",", ".")))).replace(".", ","));
    await page.getByRole("button", { name: "Adicionar ambiente" }).click();
  };
  await room("Sala", "6", "5");
  await room("Quarto", "4", "3,5");
  await page.getByText("Ajustes do orçamento").click();
  await page.getByLabel("Observações para o cliente (opcional)").fill("Cliente prefere branco neve nas paredes e no teto. Início a combinar depois do pagamento da entrada.");
  if (materiais) {
    await page.getByLabel("Lista de materiais da obra (opcional)").fill("2 latas de tinta acrílica branco neve 18 L\n1 massa corrida 25 kg\n3 rolos de lã 23 cm\nFita crepe 48 mm");
    await page.getByRole("button", { name: "Não", exact: true }).first().click(); // mostrar a lista no PDF
  }
  if (comValores) await page.getByRole("button", { name: "Não", exact: true }).last().click();
  if (comLink) await page.locator("div", { hasText: /^Cartão \(pelo seu link de pagamento\)/ }).last().getByRole("button").click();
  if (comLink) await page.getByPlaceholder("https://").fill("https://pague.exemplo.com.br/0042");
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);

  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByText("Enviar pelo WhatsApp").click()]);
  await dl.saveAs(`${OUT}/pdf-${nome}.pdf`);
  console.log(`pdf-${nome}.pdf gerado | erros de console:`, errors.length ? errors : "nenhum");
  await ctx.close();
}

await gerar({ nome: "a-azul-com-link", cor: "#0F3B7A", comValores: false, comLink: true, materiais: true });
await gerar({ nome: "b-verde-valores", cor: "#0B7F44", comValores: true, comLink: false });
await browser.close();
