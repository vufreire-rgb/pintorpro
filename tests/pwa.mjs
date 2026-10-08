// Verifica o comportamento de app instalável: manifest, ícones, service worker e abertura sem internet.
import { chromium, devices } from "playwright-core";

const base = process.env.BASE ?? "http://localhost:3000";
const exe = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("pintorpro:no-tours", "1"));
const fails = [];
const check = (ok, msg) => { console.log(ok ? "OK  " : "FALHOU", msg); if (!ok) fails.push(msg); };

// 1) manifest e ícones
const m = await (await page.request.get(base + "/manifest.webmanifest")).json();
check(m.display === "standalone" && m.start_url === "/", "manifest: abre em tela cheia (standalone)");
check(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"), "manifest: ícone 512 maskable");
for (const i of m.icons) check((await page.request.get(base + i.src)).ok(), `ícone ${i.src} carrega`);
check((await page.request.get(base + "/apple-icon.png")).ok(), "ícone do iPhone (apple-icon.png) carrega");

// 2) service worker
const db = {
  version: 1,
  company: { name: "Teste", whatsapp: "1", city: "c", paymentTerms: "x", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" },
};
await page.addInitScript((d) => { if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify(d)); }, db);
await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).waitFor();
const active = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
check(active, "service worker ativo");
await page.reload();                    // garante que os arquivos foram guardados
await page.getByRole("button", { name: /nova visita/i }).waitFor();
await page.goto(base + "/orcamentos");  // visita outra tela para guardá-la também
await page.getByText("Orçamentos").first().waitFor();
await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).waitFor();

// 3) sem internet
await ctx.setOffline(true);
await page.reload();
check(await page.getByRole("button", { name: /nova visita/i }).isVisible(), "Visitas abre SEM internet");
await page.goto(base + "/orcamentos").catch(() => {});
check(await page.getByText("Orçamentos").first().isVisible().catch(() => false), "tela já visitada abre SEM internet");
// Tela nunca aberta + sem internet: verificado manualmente com o servidor desligado (o modo offline simulado do Playwright
// nem sempre alcança o service worker, então não dá para automatizar de forma confiável aqui).
await ctx.setOffline(false);

// 4) banner de instalação
await page.goto(base + "/visitas");
await page.getByRole("button", { name: /nova visita/i }).waitFor();
check(await page.getByText("Instale o Medde no celular").isVisible(), "aviso de instalação aparece em Visitas");
await page.screenshot({ path: `${process.env.OUT ?? "/tmp"}/pwa-visitas.png` });
await page.getByRole("button", { name: "Agora não" }).click();
check(!(await page.getByText("Instale o Medde no celular").isVisible()), "'Agora não' esconde o aviso");

await browser.close();
if (fails.length) { console.log("\nFALHARAM:", fails.length); process.exit(1); }
console.log("\nTudo certo.");
