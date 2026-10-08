import { chromium, devices } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
await page.addInitScript(() => { localStorage.setItem("pintorpro:no-tours", "1"); if (!localStorage.getItem("pintorpro:v1")) localStorage.setItem("pintorpro:v1", JSON.stringify({version:1,company:{name:"Silva Pinturas",whatsapp:"1",city:"SP",paymentTerms:"x",hoursPerDay:8,marginPct:30,dailyRateCents:25000,safetyDays:1,pricingMode:"base_price"},services:[],materials:[],enabledServiceIds:[],quotes:[],works:[],clients:[],visits:[],counters:{quote:0}})); });
await page.goto("http://localhost:3000/loja"); await page.waitForTimeout(3500);
await page.screenshot({ path: process.argv[2] });
