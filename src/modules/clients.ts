import { uid, updateDb } from "./db";
import type { Client, Db } from "./types";

export function addClient(data: Omit<Client, "id">): Client {
  const client = { ...data, id: uid() };
  updateDb((db) => ({ ...db, clients: [client, ...db.clients] }));
  return client;
}

export const updateClient = (id: string, data: Omit<Client, "id">) =>
  updateDb((db) => ({ ...db, clients: db.clients.map((c) => (c.id === id ? { ...c, ...data } : c)) }));

/** Só apaga cliente sem visitas nem orçamentos (evita deixar registros órfãos). Retorna o motivo se não puder. */
export function deleteClient(db: Db, id: string): string | null {
  const visits = db.visits.filter((v) => v.clientId === id).length;
  const quotes = db.quotes.filter((q) => q.clientId === id).length;
  if (visits || quotes) return `Este cliente tem ${visits} visita(s) e ${quotes} orçamento(s). Apague-os primeiro.`;
  updateDb((d) => ({ ...d, clients: d.clients.filter((c) => c.id !== id) }));
  return null;
}
