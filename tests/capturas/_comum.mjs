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
    // auditoria rápida: alvos de toque abaixo de 44 px e textos abaixo de 16 px (fora da barra de baixo)
    const aud = await page.evaluate(() => {
      const out = { toque: [], texto: [] };
      for (const el of document.querySelectorAll("button, a[href], input, select, textarea, summary")) {
        if (el.closest("nav") || el.closest("[hidden]") || el.getAttribute("aria-hidden") === "true") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
        if (el.tagName === "INPUT" && (el.type === "file" || el.type === "hidden")) continue;
        if (r.height < 44) out.toque.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40)} (${Math.round(r.height)}px)`);
      }
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent.trim(); const el = n.parentElement;
        if (!t || !el || el.closest("nav") || getComputedStyle(el).visibility === "hidden" || el.getBoundingClientRect().height === 0) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 15.9) out.texto.push(`${t.slice(0, 40)} (${fs}px)`);
      }
      return out;
    });
    if (inv) fs.writeFileSync(base + ".aud.json", JSON.stringify(aud, null, 1));
    if (inv) fs.writeFileSync(base + ".json", JSON.stringify(await inventario(page), null, 1));
  }
  return { snap, count: () => n };
}
