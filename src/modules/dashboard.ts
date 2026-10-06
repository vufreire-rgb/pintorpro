import { lateCents } from "./finance";
import { remainingCents } from "./workInfo";
import type { Db } from "./types";

/** Números do painel (ficam recolhidos na aba Obras). */
export function dashboard(db: Db) {
  const now = new Date();
  const sameMonth = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const works = db.works.filter((w) => !w.isExample);
  const wonMonth = db.quotes.filter((q) => q.status === "won" && sameMonth(q.closedAt));
  return {
    soldMonthCents: wonMonth.reduce((s, q) => s + q.result.totals.totalCents, 0),
    profitMonthCents: wonMonth.reduce((s, q) => s + q.result.totals.profitCents, 0),
    receivableCents: works.reduce((s, w) => s + remainingCents(w), 0),
    lateCents: works.reduce((s, w) => s + lateCents(w), 0),
    worksActive: works.filter((w) => w.status === "in_progress" || w.status === "issues").length,
  };
}
