// Verifica que o áudio gravado toca em qualquer aparelho (formato universal), mesmo se o navegador só gravar WebM.
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });

async function run(forceWebm) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["microphone", "camera"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (forceWebm) await page.addInitScript(() => { MediaRecorder.isTypeSupported = (t) => /webm/.test(t); });
  const db = {
    version: 1,
    company: { name: "T", whatsapp: "1", city: "c", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
    clients: [{ id: "c1", name: "Ana", phone: "", address: "" }],
    visits: [{ id: "v1", clientId: "c1", siteAddress: "", notes: "", photoIds: [], createdAt: new Date().toISOString() }],
  };
  await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
  await page.goto(base + "/visitas/v1");
  await page.getByRole("button", { name: /Gravar áudio/ }).click();
  await page.getByRole("button", { name: /Sim, avisei/ }).click();
  await page.getByRole("button", { name: /Parar e guardar/ }).waitFor();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Parar e guardar/ }).click();
  await page.getByText("Áudio (1)").waitFor();
  const mime = await page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).visits[0].audios[0].mime);
  const info = await page.evaluate(async () => {
    const a = document.querySelector("audio");
    await new Promise((r) => { if (a.readyState >= 1) r(); else a.addEventListener("loadedmetadata", r, { once: true }); setTimeout(r, 5000); });
    return { duration: a.duration };
  });
  console.log(forceWebm ? "[forçando WebM]" : "[padrão do navegador]", "formato salvo:", mime, "| duração:", info.duration?.toFixed?.(2), "| botão baixar:", info.hasDownload, "| erros:", errors.length ? errors : "nenhum");
  const ok = /wav|mp4a|aac/.test(mime) && !/opus/.test(mime) && info.duration > 1 && errors.length === 0;
  await ctx.close();
  return ok;
}

const results = [await run(false), await run(true)];
await browser.close();
if (!results.every(Boolean)) { console.log("FALHOU"); process.exit(1); }
console.log("OK: áudio sai em formato universal nos dois casos");
