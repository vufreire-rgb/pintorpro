// Captura as telas do app em modo local (sem nuvem): imagem + inventário de texto de cada uma.
// Uso: OUTD=/pasta node tests/capturas/local.mjs  (precisa do app em http://localhost:3000, build sem Supabase)
import { chromium, devices } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarCaptura } from "./_comum.mjs";
const base = "http://localhost:3000";
const here = path.dirname(fileURLToPath(import.meta.url));
const { snap, count } = criarCaptura(process.env.OUTD);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-blink-features=AutomationControlled", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const mk = async () => { const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", permissions: ["microphone", "camera"] }); await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1")); return [ctx, await ctx.newPage()]; };
const next = (page) => page.getByRole("button", { name: /Continuar|Começar/ }).click();
const abrir = async (page, nome) => { const b = page.getByRole("button", { name: nome }).first(); if ((await b.getAttribute("aria-expanded").catch(() => null)) === "false") await b.click(); };

let [ctx, page] = await mk();
await page.goto(base);
await page.waitForTimeout(250);
await page.screenshot({ path: `${process.env.OUTD}/000-abertura-splash.png` });
await page.waitForURL("**/onboarding");
await snap(page, "cadastro-1-nome", { wait: 4200 });
await page.getByPlaceholder("Ex.: João Pinturas").fill("Silva Pinturas"); await next(page);
await snap(page, "cadastro-2-whatsapp-e-modo");
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next(page);
await page.waitForURL(base + "/visitas");
await snap(page, "visitas-vazia-primeiros-passos");
await page.goto(base + "/configuracoes");
await page.getByText("Seu orçamento em PDF").click();
await page.setInputFiles('[data-testid="logo-input"]', path.join(here, "logo-demo.png"));
await page.getByAltText("Seu logo").waitFor();

await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).click();
await snap(page, "visitas-nova-visita-opcoes");
await page.getByRole("button", { name: "Começar agora" }).click();
await page.waitForURL(/\/visitas\/[0-9a-f-]{36}$/);
await snap(page, "visita-aberta-vazia");
await page.getByTestId("photo-input").setInputFiles([path.join(here, "../foto-teste.png"), path.join(here, "../foto-teste.png"), path.join(here, "../foto-teste.png")]);
await page.getByRole("button", { name: /Gravar áudio/ }).click();
await page.getByText("Você avisou o cliente?").waitFor();
await snap(page, "visita-aviso-gravacao");
await page.getByRole("button", { name: /Sim, avisei/ }).click();
await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Medida/ }).click();
await snap(page, "visita-gravando-audio-com-marcas", { wait: 600 });
await page.getByRole("button", { name: /Parar e guardar/ }).click();
await page.waitForTimeout(800);
await page.getByPlaceholder(/Cliente quer cor/).fill("Sala e dois quartos. Mofo perto da janela da sala.");
await page.getByLabel(/Endereço da obra/).fill("Rua das Flores, 120 - Centro, Taubaté - SP");
await page.getByRole("button", { name: /Anotar as medidas/ }).click();
await page.getByPlaceholder("Ex.: Sala").fill("Sala");
await page.getByLabel("Parede 1 largura").fill("5");
await page.getByRole("button", { name: "Parede", exact: true }).click();
await page.getByLabel("Parede 2 largura").fill("4");
await snap(page, "visita-medidas-formulario", { full: true });
await page.getByRole("button", { name: "Salvar ambiente" }).click();
await page.waitForTimeout(600);
await snap(page, "visita-completa", { full: true });
await snap(page, "visita-topo");
await page.getByRole("button", { name: "Salvar visita" }).click();
await page.getByRole("heading", { name: "Quem é o cliente?" }).waitFor();
await snap(page, "visita-quem-e-o-cliente");
await page.getByText("Nome do cliente").locator("..").locator("input").fill("Ana Souza");
await page.getByText("Telefone (WhatsApp)").last().locator("..").locator("input").fill("11977776666");
await page.getByRole("button", { name: "Salvar visita" }).last().click();
await page.waitForURL(/\/visitas$/);

await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("pintorpro:v1"));
  const DAY = 86400000, iso = (t) => new Date(t).toISOString();
  const ym = (o) => { const t = new Date(Date.now() + o * DAY); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const cl = (id, name, phone, address) => ({ id, name, phone, address });
  d.clients.push(cl("c2", "Carlos Mendes", "11 98888-2222", "Av. Brasil, 45"), cl("c3", "Mariana Lopes", "12 99111-3333", "Rua do Sol, 8"), cl("c4", "Edifício Aurora", "12 3222-4444", "Rua Bela Vista, 300"), cl("c5", "Felipe Andrade", "12 99777-5555", "Rua Bela Vista - 1º Subdistrito, Taubaté"));
  const vis = (id, client, o) => ({ id, clientId: client, siteAddress: "", notes: "", photoIds: [], createdAt: iso(Date.now() - DAY), ...o });
  d.visits.push(
    vis("v-ag1", "c5", { siteAddress: "Rua Bela Vista - 1º Subdistrito, Taubaté - SP", scheduledAt: iso(Date.now() + 3600000 * 2) }),
    vis("v-ag2", "c3", { siteAddress: "Rua do Sol, 8", scheduledAt: iso(Date.now() + DAY) }),
    vis("v-sem", "c2", { siteAddress: "Av. Brasil, 45", notes: "Fachada e portão", startedAt: iso(Date.now() - 2 * DAY) }),
    vis("v-orc", "c4", { siteAddress: "Rua Bela Vista, 300", startedAt: iso(Date.now() - 4 * DAY), quoteId: "q-pers" }),
  );
  const quote = (id, number, status, client, total, addr, extra = {}) => ({ id, number, clientId: client, siteAddress: addr, status, createdAt: iso(Date.now() - number * DAY), validUntil: iso(Date.now() + (7 - number) * DAY), paymentTerms: "50% na entrada e 50% na entrega", notes: "", input: { rooms: [], extras: [] }, configSnapshot: {}, engineVersion: "t", result: { totals: { totalCents: total }, schedule: { workDays: 3, totalDays: 3, hours: 24 }, serviceLines: [], materialLines: [], measures: [], extras: [], warnings: [] }, ...extra });
  d.quotes.push(quote("q-pers", 5, "open", "c4", 1280000, "Rua Bela Vista, 300"), quote("q-ven", 6, "won", "c3", 350000, "Rua do Sol, 8", { closedAt: iso(Date.now() - DAY) }), quote("q-ven2", 7, "won", "c2", 520000, "Av. Brasil, 45", { closedAt: iso(Date.now() - 2 * DAY) }), quote("q-perd", 8, "lost", "c2", 180000, "Av. Brasil, 45", { closedAt: iso(Date.now() - 2 * DAY) }));
  const w = (id, quoteId, client, total, o) => ({ id, quoteId, clientId: client, title: id, status: "in_progress", createdAt: iso(Date.now()), plannedDays: 3, plannedHours: 24, plannedTotalCents: total, plannedCostCents: Math.round(total * 0.35), ...o });
  d.works.push(
    w("w1", "q-ven", "c3", 350000, { startDate: ym(-2), endDate: ym(1), payments: [{ id: "p1", date: ym(-2), amountCents: 175000, note: "Entrada", method: "pix" }], expenses: [{ id: "e1", date: ym(-1), kind: "material", amountCents: 48000, note: "4 latas de tinta" }], plan: [{ id: "i1", label: "Entrada", dueDate: ym(-2), amountCents: 175000 }, { id: "i2", label: "Pagamento final", dueDate: ym(1), amountCents: 175000 }], daysWorked: 2 }),
    w("w2", "q-ven2", "c2", 520000, { status: "scheduled", startDate: ym(4), endDate: ym(8) }),
  );
  localStorage.setItem("pintorpro:v1", JSON.stringify(d));
});
await page.goto(base + "/visitas");
await snap(page, "visitas-agendadas");
await page.getByRole("tab", { name: /A orçar/ }).click();
await snap(page, "visitas-a-orcar");
await page.getByRole("button", { name: /Visitas com orçamento feito/ }).click();
await snap(page, "visitas-ja-orcadas");
await page.goto(base + "/visitas/agendar");
await snap(page, "agendar-visita");

await page.goto(base + "/visitas");
await page.getByRole("tab", { name: /A orçar/ }).click();
await page.getByText("Ana Souza").first().click();
await page.getByRole("link", { name: "Montar orçamento" }).click();
await page.getByText("Ambientes e serviços").waitFor();
await snap(page, "novo-orcamento-topo");
await snap(page, "novo-orcamento-completo", { full: true });
await page.getByText("Ajustes do orçamento").click();
await snap(page, "novo-orcamento-ajustes-opcionais", { full: true });
await page.getByRole("button", { name: "Salvar orçamento" }).click();
await page.waitForURL(/orcamentos\/[0-9a-f-]{36}/);
await page.getByText("Enviar pelo WhatsApp").waitFor();
await snap(page, "orcamento-detalhe-com-convite-pix");
await snap(page, "orcamento-detalhe-completo", { full: true });
await page.getByRole("button", { name: "Agora não" }).click();
await snap(page, "orcamento-detalhe-sem-convite");
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pintorpro:v1")); d.company.pix = { type: "email", key: "silva@exemplo.com" }; localStorage.setItem("pintorpro:v1", JSON.stringify(d)); });

await page.goto(base + "/orcamentos");
await snap(page, "orcamentos-abertos");
const cdp = await ctx.newCDPSession(page);
const drag = async (loc, dx, release) => { const b = await loc.boundingBox(); const y = b.y + b.height / 2, x0 = b.x + b.width / 2; await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] }); for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / 8, y }] }); if (release) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
await drag(page.locator("a", { hasText: "Edifício Aurora" }), 90, false);
await snap(page, "orcamentos-arrastando-para-fechou", { wait: 300, inv: false });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await drag(page.locator("a", { hasText: "Edifício Aurora" }), -90, false);
await snap(page, "orcamentos-arrastando-para-perdeu", { wait: 300, inv: false });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(400);
await drag(page.locator("a", { hasText: "Edifício Aurora" }), -220, true);
await page.getByText("Marcar como perdido?").waitFor();
await snap(page, "orcamentos-pergunta-perdido", { wait: 300 });
await page.getByRole("button", { name: "Cancelar" }).click();
await page.getByRole("tab", { name: /Fechado/ }).click();
await snap(page, "orcamentos-fechados");
await page.getByRole("tab", { name: /Perdido/ }).click();
await snap(page, "orcamentos-perdidos");
await page.getByRole("tab", { name: /Aberto/ }).click();
await page.locator("a", { hasText: "Edifício Aurora" }).click();
await page.getByRole("button", { name: "Fechou! Criar a obra" }).waitFor();
await snap(page, "orcamento-detalhe-aberto");
await page.getByRole("button", { name: "Fechou! Criar a obra" }).click();
await page.waitForTimeout(600);
await snap(page, "orcamento-fechou-comemoracao", { wait: 300 });
await page.getByRole("button", { name: "Fechar" }).first().click().catch(() => {});

await page.goto(base + "/obras");
await snap(page, "obras-lista");
await page.locator("a", { hasText: "Mariana Lopes" }).click();
await page.waitForURL(/obras\/w1$/);
await snap(page, "obra-topo");
await snap(page, "obra-completa", { full: true });
await page.goto(base + "/obras/resultado");
await snap(page, "resultado-do-mes");

await page.goto(base + "/clientes");
await snap(page, "clientes-lista");
await page.getByRole("button", { name: "Novo cliente" }).click();
await snap(page, "clientes-novo");

await page.goto(base + "/configuracoes");
await snap(page, "ajustes-topo");
await snap(page, "ajustes-completo", { full: true });
for (const t of ["Seu negócio", "Seu orçamento em PDF", "Receber por Pix", "Lembrete de revisão", "Como você faz orçamento?", "Serviços e preços", "Materiais", "Avançado: custos e lucro"]) {
  await page.goto(base + "/configuracoes");
  await page.getByText(t, { exact: true }).first().click();
  await snap(page, "ajustes-aberto-" + t.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, "-"), { full: true });
}
for (const [p, nm] of [["/privacidade", "privacidade"], ["/termos", "termos"], ["/excluir-conta", "excluir-conta"]]) { await page.goto(base + p); await snap(page, "pagina-" + nm); }
await ctx.close();

[ctx, page] = await mk();
await page.goto(base); await page.waitForURL("**/onboarding");
await page.getByPlaceholder("Ex.: João Pinturas").fill("Pinturas Rápidas"); await next(page);
await page.getByRole("button", { name: /Só voz e preço fechado/ }).click();
await snap(page, "simples-cadastro-escolha-voz");
await page.getByPlaceholder("(11) 99999-9999").fill("11988887777"); await next(page);
await page.waitForURL(base + "/visitas");
await page.goto(base + "/orcamentos/novo");
await page.getByLabel("Nome do cliente").fill("Dona Maria");
await page.getByLabel("Endereço da obra").fill("Rua das Flores, 10");
await page.getByLabel("O que será feito").fill("Pintura da sala e dos quartos, tinta inclusa");
await page.getByLabel("Preço fechado").fill("2800");
await snap(page, "simples-novo-orcamento", { full: true });
await ctx.close();
await browser.close();
console.log("telas:", count());
