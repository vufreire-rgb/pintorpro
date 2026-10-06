import { updateDb } from "./db";
import type { Company, Db, EngineConfig, MaterialConfig, ServiceConfig } from "./types";

export function buildEngineConfig(db: Db): EngineConfig {
  const c = db.company;
  if (!c) throw new Error("Empresa não configurada");
  return {
    services: db.services.filter((s) => db.enabledServiceIds.includes(s.id)),
    materials: db.materials,
    crew: { workers: 1, hourlyCostCents: Math.round(c.dailyRateCents / c.hoursPerDay) },
    hoursPerDay: c.hoursPerDay,
    safetyDays: c.safetyDays,
    pricingMode: c.pricingMode,
    marginMode: c.marginMode,
    marginPct: c.marginPct,
  };
}

export const DEFAULT_COMPANY: Company = {
  name: "",
  whatsapp: "",
  city: "",
  paymentTerms: "50% na entrada e 50% na entrega",
  hoursPerDay: 8,
  marginPct: 30,
  dailyRateCents: 25000,
  safetyDays: 1,
  pricingMode: "base_price",
  marginMode: "on_price",
  brandColor: "#0F3B7A",
  depositPct: 50,
};

/** Marca um guia como visto/pulado (ou `null` para ver de novo). */
export const setTour = (id: string, state: "done" | "skipped" | null) =>
  updateDb((db) => {
    if (!db.company) return db;
    const tours = { ...db.company.tours };
    if (state) tours[id] = state;
    else delete tours[id];
    return { ...db, company: { ...db.company, tours } };
  });

export const saveCompany = (company: Company) => updateDb((db) => ({ ...db, company }));
export const setEnabledServices = (ids: string[]) => updateDb((db) => ({ ...db, enabledServiceIds: ids }));
export const updateService = (id: string, patch: Partial<ServiceConfig>) =>
  updateDb((db) => ({ ...db, services: db.services.map((s) => (s.id === id ? { ...s, ...patch, isDemo: false } : s)) }));
export const updateMaterial = (id: string, patch: Partial<MaterialConfig>) =>
  updateDb((db) => ({ ...db, materials: db.materials.map((m) => (m.id === id ? { ...m, ...patch, isDemo: false } : m)) }));
