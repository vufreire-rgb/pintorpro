// Localização: ponto no mapa + endereço escrito (OpenStreetMap simulado).
import { chromium, devices } from "playwright-core";
const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const errors = [];
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };
const db = {
  version: 1,
  company: { name: "Silva Pinturas", whatsapp: "(11) 90000-0000", city: "SP", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
  services: [], materials: [], enabledServiceIds: [], quotes: [], works: [], counters: { quote: 0 },
  clients: [{ id: "c1", name: "Jessica", phone: "11 99999-1111", address: "" }],
  visits: [{ id: "v1", clientId: "c1", siteAddress: "J", notes: "", photoIds: [], createdAt: new Date().toISOString() }],
};
async function nova(opts) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
  return page;
}
const visita = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pintorpro:v1")).visits[0]);

// 1) permitido + endereço encontrado
let page = await nova({ geolocation: { latitude: -22.9056, longitude: -47.0608, accuracy: 12 }, permissions: ["geolocation"] });
await page.route("https://nominatim.openstreetmap.org/**", (r) => r.fulfill({ json: { address: { road: "Rua das Flores", house_number: "120", suburb: "Centro", city: "Campinas", "ISO3166-2-lvl4": "BR-SP" } } }));
await page.goto(base + "/visitas/v1");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText("Endereço preenchido").waitFor();
let v = await visita(page);
check(v.siteAddress === "Rua das Flores, 120 - Centro, Campinas - SP", "endereço escrito preenchido (" + v.siteAddress + ")");
check(Math.abs(v.location.lat + 22.9056) < 0.001 && v.location.accuracy === 12, "coordenadas e precisão guardadas");
check(await page.getByText(/colaboradores do/).isVisible(), "crédito do OpenStreetMap aparece (exigência do serviço grátis)");
check(await page.getByText(/Ponto no mapa salvo \(precisão de cerca de 12 m\)/).isVisible(), "aviso de ponto salvo");
const maps = await page.locator("a", { hasText: "Mapa" }).first().getAttribute("href");
check(maps.includes("query=-22.9056,-47.0608"), "botão Mapa abre nas coordenadas exatas");
await page.screenshot({ path: "/tmp/localizacao.png", fullPage: true });
await page.context().close();

// 2) permitido, mas o serviço de endereço está fora do ar: guarda o ponto e avisa
page = await nova({ geolocation: { latitude: -22.9, longitude: -47.0 }, permissions: ["geolocation"] });
await page.route("https://nominatim.openstreetmap.org/**", (r) => r.abort());
await page.goto(base + "/visitas/v1");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/não consegui descobrir o nome da rua/).waitFor();
v = await visita(page);
check(v.location && v.siteAddress === "J", "sem serviço de endereço: ponto guardado e endereço digitado preservado");
await page.context().close();

// 3) permissão negada: mensagem clara, nada é alterado
page = await nova({ permissions: [] });
await page.goto(base + "/visitas/v1");
await page.getByRole("button", { name: "Usar minha localização" }).click();
await page.getByText(/não deixou o app usar a localização/).waitFor();
v = await visita(page);
check(!v.location && v.siteAddress === "J", "permissão negada: nada alterado");
await page.context().close();

console.log("erros de console:", errors.length ? errors : "nenhum");
await browser.close();
if (fails.length || errors.length) { console.log("\nFALHARAM:", fails); process.exit(1); }
console.log("\nTudo certo.");
