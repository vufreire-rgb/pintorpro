// Gera o PDF do orçamento pelo app (fotos, 2 ambientes) e salva em OUT/pdf-<nome>.pdf para conferir contra o desenho do designer.
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT ?? "/tmp";
const browser = await chromium.launch({ executablePath: exe });

async function gerar({ nome, cor, comValores, comLink }) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  const page = await ctx.newPage();
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
  await page.getByTestId("photo-input").setInputFiles(["/tmp/photos/foto1.jpg", "/tmp/photos/foto2.jpg", "/tmp/photos/foto3.jpg"]);
  await page.getByText("Fotos (3)").waitFor();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Pôr no PDF" }).first().click();
  const salas = ["Sala", "Sala", "Quarto"], legs = ["Rachadura perto da janela", "Tinta descascando", "Canto do teto com mofo"];
  for (let i = 0; i < 3; i++) {
    await page.getByPlaceholder(`Foto ${i + 1}: ambiente`).fill(salas[i]);
    await page.getByPlaceholder("Legenda").nth(i).fill(legs[i]);
  }

  // orçamento: 2 ambientes
  await page.getByRole("link", { name: "Montar orçamento" }).click();
  await page.getByText("Comprim. (m)").waitFor();
  const room = async (n, c, l, cond) => {
    await page.getByPlaceholder("Ex.: Sala").fill(n);
    await page.getByText("Comprim. (m)").locator("..").locator("input").fill(c);
    await page.getByText("Largura (m)").locator("..").locator("input").fill(l);
    if (cond) await page.getByRole("button", { name: cond }).click();
    await page.getByText("+ Adicionar ambiente").click();
  };
  await room("Sala", "6", "5", "Com trincas");
  await room("Quarto", "4", "3,5", "Já pintada, boa");
  await page.getByRole("button", { name: "Continuar" }).click(); // serviços
  await page.getByRole("button", { name: "Continuar" }).click(); // materiais
  await page.getByRole("button", { name: "Continuar" }).click(); // preço
  await page.getByPlaceholder("Observações").or(page.getByText("Observações (opcional)").locator("..").locator("input")).first().fill("Cliente prefere branco neve nas paredes e no teto. Início a combinar depois do pagamento da entrada.");
  if (comValores) await page.getByRole("button", { name: "Não", exact: true }).click();
  if (comLink) await page.getByPlaceholder("https://").fill("https://pague.exemplo.com.br/0042");
  await page.getByRole("button", { name: "Continuar" }).click(); // revisão
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);

  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByText("Enviar pelo WhatsApp").click()]);
  await dl.saveAs(`${OUT}/pdf-${nome}.pdf`);
  console.log(`pdf-${nome}.pdf gerado | erros de console:`, errors.length ? errors : "nenhum");
  await ctx.close();
}

await gerar({ nome: "a-azul-com-link", cor: "#0F3B7A", comValores: false, comLink: true });
await gerar({ nome: "b-verde-valores", cor: "#0B7F44", comValores: true, comLink: false });
await browser.close();
