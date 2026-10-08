// Fotos: o arquivo guardado nunca leva EXIF/GPS; foto ilegível não é guardada (e a pessoa é avisada).
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await ctx.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const db = {
  version: 1,
  company: { name: "Silva", whatsapp: "1", city: "c", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
  services: [], materials: [], enabledServiceIds: [], quotes: [], works: [], counters: { quote: 0 },
  clients: [{ id: "c1", name: "Ana", phone: "1", address: "Rua A" }],
  visits: [{ id: "v1", clientId: "c1", siteAddress: "Rua A", notes: "", photoIds: [], createdAt: new Date().toISOString(), startedAt: new Date().toISOString() }],
};
await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
await page.goto(base + "/visitas/v1");
await page.getByText("Nenhuma foto", { exact: true }).waitFor();

// JPEG de verdade com um bloco EXIF falso contendo GPS
const withExif = await page.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = 60; c.height = 40;
  const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 60, 40);
  const buf = new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9))).arrayBuffer());
  const payload = new TextEncoder().encode("Exif\0\0MM\0*GPSLatitude=-23.55 GPSLongitude=-46.63");
  const len = payload.length + 2;
  const app1 = new Uint8Array([0xff, 0xe1, len >> 8, len & 255, ...payload]);
  const out = new Uint8Array(buf.length + app1.length);
  out.set(buf.slice(0, 2)); out.set(app1, 2); out.set(buf.slice(2), 2 + app1.length);
  return Array.from(out);
});
check(Buffer.from(withExif).includes("GPSLatitude"), "arquivo de teste tem GPS dentro");
await page.getByTestId("photo-input").setInputFiles([{ name: "gps.jpg", mimeType: "image/jpeg", buffer: Buffer.from(withExif) }]);
await page.getByText("1 foto", { exact: true }).waitFor();

const stored = async () => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open("pintorpro-files", 1);
  req.onsuccess = async () => {
    const tx = req.result.transaction("photos", "readonly").objectStore("photos");
    const all = tx.getAll();
    all.onsuccess = async () => {
      const out = [];
      for (const b of all.result) out.push({ type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) });
      resolve(out);
    };
  };
}));
const files = await stored();
const text = (arr) => Buffer.from(arr).toString("latin1");
check(files.length === 1 && files[0].type === "image/jpeg", "foto guardada como JPEG novo");
check(!text(files[0].bytes).includes("GPS") && !text(files[0].bytes).includes("Exif"), "arquivo guardado SEM EXIF e SEM GPS");

// arquivo que não é imagem de verdade
await page.getByTestId("photo-input").setInputFiles([{ name: "ruim.jpg", mimeType: "image/jpeg", buffer: Buffer.from("isto nao e uma imagem") }]);
await page.getByText(/Não consegui ler 1 foto/).waitFor();
check(true, "foto ilegível: a pessoa é avisada");
check((await stored()).length === 1, "foto ilegível NÃO é guardada (nem o original)");
check(await page.getByText("1 foto", { exact: true }).isVisible(), "a visita continua com 1 foto");
console.log(errors.length ? "ERROS DE CONSOLE: " + errors.join("; ") : "erros de console: nenhum");
await browser.close();
if (fails.length) { console.log("\n" + fails.length + " falha(s)"); process.exit(1); }
console.log("\nTudo certo.");
