// Peças comuns dos scripts de captura: gravam a imagem e um inventário de texto de cada tela.
// O inventário abre (e depois fecha) todos os blocos recolhíveis, para comparar "antes" e "depois" sem esconder nada.
import fs from "node:fs";

const HIDE = "nav.fixed, div.fixed.inset-x-0:not([role=dialog]):not([role=status]) { display: none !important; } header.sticky { position: static !important; }";

export function criarCaptura(out, startIndex = 0) {
  fs.mkdirSync(out, { recursive: true });
  let n = startIndex;
  const navAt = new WeakMap();
  const track = (pg) => { pg.on("framenavigated", (f) => { if (f === pg.mainFrame()) navAt.set(pg, Date.now()); }); };
  const slug = (s) => s.replace(/[^a-z0-9-]/gi, "-");

  async function inventario(page) {
    return page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const toggles = [];
      document.querySelectorAll("details:not([open]) > summary").forEach((s) => { toggles.push(s); });
      const closedBtns = [...document.querySelectorAll('[aria-expanded="false"]')].filter((b) => b.tagName === "BUTTON" && !b.closest("nav"));
      toggles.forEach((s) => s.click());
      closedBtns.forEach((b) => b.click());
      return new Promise((resolve) => setTimeout(() => {
        const txt = [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && vis(el) && (el.textContent ?? "").trim()).map((el) => (el.textContent ?? "").trim().replace(/\s+/g, " "));
        const buttons = [...document.querySelectorAll("button, [role=button], [role=tab]")].filter(vis).map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().replace(/\s+/g, " "));
        const links = [...document.querySelectorAll("a")].filter(vis).map((a) => ({ t: (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " "), h: a.getAttribute("href") }));
        const fields = [...document.querySelectorAll("input, textarea, select")].filter(vis).map((f) => ({ n: f.getAttribute("aria-label") || f.labels?.[0]?.textContent?.trim() || f.placeholder || f.type, t: f.type }));
        // desfaz: fecha de novo o que foi aberto
        toggles.forEach((s) => s.click());
        [...closedBtns].forEach((b) => { if (b.getAttribute("aria-expanded") === "true") b.click(); });
        resolve({ txt, buttons, links, fields });
      }, 350));
    });
  }

  async function snap(page, name, { full = false, wait = 700, inv = true } = {}) {
    if (!navAt.has(page)) track(page);
    const since = Date.now() - (navAt.get(page) ?? 0);
    await page.waitForTimeout(Math.max(wait, 2600 - since));
    if (full) await page.addStyleTag({ content: HIDE });
    n++;
    const id = String(n).padStart(3, "0");
    const base = `${out}/${id}-${slug(name)}`;
    await page.screenshot({ path: base + ".png", fullPage: full });
    if (full) await page.evaluate(() => document.querySelectorAll("style").forEach((el) => el.textContent?.includes("display: none !important") && el.remove()));
    if (inv) fs.writeFileSync(base + ".json", JSON.stringify(await inventario(page), null, 1));
  }
  return { snap, count: () => n };
}
