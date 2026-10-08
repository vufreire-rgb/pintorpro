import { updateDb } from "./db";
import { suggestEnd } from "./workInfo";
import { removePhotoFile } from "./photos";
import type { Expense, Installment, Payment, WorkStatus, Work } from "./types";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  issues: "Pendências",
  done: "Concluída",
};

const patch = (id: string, fn: (w: Work) => Work) =>
  updateDb((db) => ({ ...db, works: db.works.map((w) => (w.id === id ? fn(w) : w)) }));

/** Reabrir uma obra concluída marca `keepOpen`, para o app não concluir de novo sozinho. */
export const setWorkStatus = (id: string, status: WorkStatus) =>
  patch(id, (w) => ({ ...w, status, keepOpen: status === "done" ? undefined : w.status === "done" && status === "in_progress" ? true : w.keepOpen }));

/** Define o início; se ainda não há término (ou ficou antes do início), sugere um pelos dias previstos. */
export const setWorkStart = (id: string, startDate: string) =>
  patch(id, (w) => {
    if (!startDate) return { ...w, startDate: undefined };
    const endOk = w.endDate && w.endDate >= startDate;
    return { ...w, startDate, endDate: endOk ? w.endDate : suggestEnd(startDate, w.plannedDays) };
  });

export const setWorkEnd = (id: string, endDate: string) => patch(id, (w) => ({ ...w, endDate: endDate || undefined }));

export const addPayment = (id: string, p: Omit<Payment, "id">) =>
  patch(id, (w) => ({ ...w, payments: [...(w.payments ?? []), { ...p, id: crypto.randomUUID() }] }));

/** Apaga o pagamento (e a foto do comprovante, se houver). */
export function removePayment(id: string, paymentId: string, proofId?: string): void {
  patch(id, (w) => ({ ...w, payments: (w.payments ?? []).filter((p) => p.id !== paymentId) }));
  if (proofId) void removePhotoFile(proofId);
}

export const setPlan = (id: string, plan: Installment[]) => patch(id, (w) => ({ ...w, plan }));
export const updateInstallment = (id: string, instId: string, patchIn: Partial<Omit<Installment, "id">>) =>
  patch(id, (w) => ({ ...w, plan: (w.plan ?? []).map((p) => (p.id === instId ? { ...p, ...patchIn } : p)) }));
export const addInstallment = (id: string, inst: Omit<Installment, "id">) =>
  patch(id, (w) => ({ ...w, plan: [...(w.plan ?? []), { ...inst, id: crypto.randomUUID() }] }));
export const removeInstallment = (id: string, instId: string) =>
  patch(id, (w) => ({ ...w, plan: (w.plan ?? []).filter((p) => p.id !== instId) }));

export const deleteWork = (id: string) =>
  updateDb((db) => {
    const w = db.works.find((x) => x.id === id);
    const drop = w?.isExample && !db.visits.some((v) => v.clientId === w.clientId) && !db.works.some((x) => x.id !== id && x.clientId === w.clientId);
    return { ...db, works: db.works.filter((x) => x.id !== id), clients: drop ? db.clients.filter((c) => !(c.isExample && c.id === w!.clientId)) : db.clients };
  });

/** Obra de treino do guia: valores de exemplo, fora do painel. Apagar a obra apaga o cliente de exemplo (se ninguém mais o usa). */
export function createExampleWork(): string {
  const id = crypto.randomUUID();
  updateDb((db) => {
    const existing = db.clients.find((c) => c.isExample);
    const client = existing ?? { id: crypto.randomUUID(), name: "Cliente Exemplo", phone: "(11) 99999-0000", address: "Rua Exemplo, 123", isExample: true };
    const work: Work = { id, quoteId: "exemplo", clientId: client.id, title: `${client.name} — ${client.address}`, status: "scheduled", createdAt: new Date().toISOString(), plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 100000, isExample: true };
    return { ...db, clients: existing ? db.clients : [client, ...db.clients], works: [work, ...db.works] };
  });
  return id;
}

export const addExpense = (id: string, e: Omit<Expense, "id">) =>
  patch(id, (w) => ({ ...w, expenses: [...(w.expenses ?? []), { ...e, id: crypto.randomUUID() }] }));
export const removeExpense = (id: string, expenseId: string) =>
  patch(id, (w) => ({ ...w, expenses: (w.expenses ?? []).filter((e) => e.id !== expenseId) }));
export const setDaysWorked = (id: string, daysWorked: number) => patch(id, (w) => ({ ...w, daysWorked: Math.max(0, daysWorked) }));
