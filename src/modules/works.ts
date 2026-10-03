import { updateDb } from "./db";
import { suggestEnd } from "./workInfo";
import type { Payment, WorkStatus, Work } from "./types";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  issues: "Pendências",
  done: "Concluída",
};

const patch = (id: string, fn: (w: Work) => Work) =>
  updateDb((db) => ({ ...db, works: db.works.map((w) => (w.id === id ? fn(w) : w)) }));

export const setWorkStatus = (id: string, status: WorkStatus) => patch(id, (w) => ({ ...w, status }));

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

export const removePayment = (id: string, paymentId: string) =>
  patch(id, (w) => ({ ...w, payments: (w.payments ?? []).filter((p) => p.id !== paymentId) }));

export const deleteWork = (id: string) => updateDb((db) => ({ ...db, works: db.works.filter((w) => w.id !== id) }));
