"use client";
import { useSyncExternalStore } from "react";
import { readRaw, subscribe, writeRaw } from "@/repositories/localStore";
import { DEFAULT_MATERIALS, DEFAULT_SERVICES } from "./catalog";
import type { Db } from "./types";

export const newDb = (): Db => ({
  version: 1,
  company: null,
  services: DEFAULT_SERVICES,
  materials: DEFAULT_MATERIALS,
  enabledServiceIds: DEFAULT_SERVICES.map((s) => s.id),
  clients: [],
  quotes: [],
  works: [],
  counters: { quote: 0 },
});

let cache: { raw: string | null; db: Db } | null = null;

function getSnapshot(): Db {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.db;
  let db = newDb();
  if (raw) {
    try {
      db = { ...db, ...(JSON.parse(raw) as Partial<Db>) };
    } catch {
      /* dados corrompidos: começa vazio */
    }
  }
  cache = { raw, db };
  return db;
}

/** Retorna null durante a renderização no servidor / antes de hidratar. */
export const useDb = (): Db | null => useSyncExternalStore(subscribe, getSnapshot, () => null);

export function updateDb(fn: (db: Db) => Db): void {
  writeRaw(JSON.stringify(fn(getSnapshot())));
}

export const uid = (): string => crypto.randomUUID();
