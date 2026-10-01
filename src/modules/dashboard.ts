import type { Db } from "./types";

export function dashboard(db: Db) {
  const now = new Date();
  const sameMonth = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const open = db.quotes.filter((q) => q.status === "open");
  const wonMonth = db.quotes.filter((q) => q.status === "won" && sameMonth(q.closedAt));
  const decided = db.quotes.filter((q) => q.status !== "open").length;
  return {
    visitsPending: db.visits.filter((v) => !v.quoteId).length,
    openCount: open.length,
    openCents: open.reduce((s, q) => s + q.result.totals.totalCents, 0),
    soldMonthCents: wonMonth.reduce((s, q) => s + q.result.totals.totalCents, 0),
    profitMonthCents: wonMonth.reduce((s, q) => s + q.result.totals.profitCents, 0),
    worksActive: db.works.filter((w) => w.status === "in_progress" || w.status === "issues").length,
    worksNext: db.works.filter((w) => w.status === "scheduled").length,
    closeRate: decided > 0 ? db.quotes.filter((q) => q.status === "won").length / decided : null,
  };
}
