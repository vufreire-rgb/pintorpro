import { updateDb } from "./db";
import type { WorkStatus } from "./types";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  issues: "Pendências",
  done: "Concluída",
};

export const setWorkStatus = (id: string, status: WorkStatus) =>
  updateDb((db) => ({ ...db, works: db.works.map((w) => (w.id === id ? { ...w, status } : w)) }));
