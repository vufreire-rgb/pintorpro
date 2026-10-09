// Marcar a foto: seta, cota, texto, cores, mover, desfazer, apagar, zoom, salvar e reabrir.
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT ?? "/tmp";
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
  services: [], materials: [], enabledServiceIds: [], quotes: [], works: [], clients: [], visits: [], counters: { quote: 0 },
};
await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
const marks = () => page.evaluate(() => { const v = JSON.parse(localStorage.getItem("pintorpro:v1")).visits[0]; return Object.values(v.photoMeta ?? {}).flatMap((m) => m.marks ?? []); });

await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).click();
await page.getByText("Nenhuma foto", { exact: true }).waitFor();
await page.getByTestId("photo-input").setInputFiles("tests/foto-teste.png");
await page.getByText("1 foto", { exact: true }).waitFor();
await page.getByRole("button", { name: "Marcar a foto" }).click();
const dlg = page.getByRole("dialog", { name: "Marcar a foto" });
await dlg.waitFor();
const cv = dlg.getByTestId("marks-canvas");
await page.waitForFunction(() => document.querySelector('[data-testid="marks-canvas"]')?.getBoundingClientRect().width > 50);
const box = await cv.boundingBox();
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(...b, { steps: 4 }); await page.mouse.up(); };
const inked = () => cv.evaluate((c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
check((await inked()) === 0, "foto começa sem marcas");

// seta
await dlg.getByRole("button", { name: /Seta/ }).click();
await drag(at(0.2, 0.2), at(0.5, 0.45));
check((await inked()) > 100, "seta desenhada na tela");
// cota com valor
await dlg.getByRole("button", { name: /Cota/ }).click();
await drag(at(0.1, 0.8), at(0.9, 0.8));
await dlg.getByLabel("Medida").fill("455");
await dlg.getByRole("button", { name: "Incluir" }).click();
// cor azul + texto
await dlg.getByRole("button", { name: "Cor #3B82F6" }).click();
await dlg.getByRole("button", { name: /Texto/ }).click();
await page.mouse.click(...at(0.6, 0.3));
await dlg.getByLabel("Texto da marca").fill("Mofo");
await dlg.getByRole("button", { name: "Incluir" }).click();
await page.screenshot({ path: `${OUT}/marcar-1.png` });

// mover o texto (ferramenta Mover): arrasta e confere que mudou de lugar
await dlg.getByRole("button", { name: /Mover/ }).click();
await drag(at(0.6, 0.3), at(0.6, 0.55));
// desfazer o movimento
await dlg.getByRole("button", { name: "Desfazer" }).click();
// apagar a seta: seleciona e usa a lixeira
await page.mouse.click(...at(0.35, 0.325));
await dlg.getByRole("button", { name: "Apagar marca" }).click();
// zoom
const before = (await cv.boundingBox()).width;
await dlg.getByRole("button", { name: "Aproximar" }).click();
await page.waitForTimeout(200);
check((await cv.boundingBox()).width > before * 1.4, "zoom aproxima a foto");
await dlg.getByRole("button", { name: "Ajustar à tela" }).click();
await dlg.getByRole("button", { name: "Salvar", exact: true }).click();
await dlg.waitFor({ state: "detached" });
const saved = await marks();
check(saved.length === 2 && saved.some((m) => m.kind === "dim" && m.text === "455") && saved.some((m) => m.kind === "text" && m.text === "Mofo"), "marcações salvas na visita (cota 455 e texto Mofo; seta apagada)");
check(saved.every((m) => m.x1 >= 0 && m.x1 <= 1 && m.y1 >= 0 && m.y1 <= 1), "coordenadas guardadas de 0 a 1");
const text = saved.find((m) => m.kind === "text");
console.log("texto y1:", text.y1, "x1:", text.x1); check(Math.abs(text.y1 - 0.3) < 0.05, "desfazer devolveu o texto ao lugar (y≈0.3)");

// miniatura mostra o contador e reabrir mantém as marcas
check(await page.getByRole("button", { name: "Marcar a foto" }).innerText().then((t) => t.includes("2")), "botão mostra 2 marcações");
await page.screenshot({ path: `${OUT}/marcar-grade.png` });
await page.reload();
await page.getByRole("button", { name: /^Fotos/ }).click();
await page.getByRole("button", { name: "Marcar a foto" }).click();
await dlg.waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="marks-canvas"]')?.getBoundingClientRect().width > 50);
check((await inked()) > 100, "ao reabrir, as marcas continuam lá");
await dlg.getByRole("button", { name: "Cancelar", exact: true }).click();
check((await marks()).length === 2, "cancelar não altera nada");

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
