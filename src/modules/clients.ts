import { uid, updateDb } from "./db";
import type { Client } from "./types";

export function addClient(data: Omit<Client, "id">): Client {
  const client = { ...data, id: uid() };
  updateDb((db) => ({ ...db, clients: [client, ...db.clients] }));
  return client;
}
