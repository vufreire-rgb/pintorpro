import type { EngineConfig, QuoteInput, QuoteResult, Room, ServiceConfig, MaterialConfig, ServiceSelection, Opening, ExtraItem, Adjustment } from "@/engine";

export type { EngineConfig, QuoteInput, QuoteResult, Room, ServiceConfig, MaterialConfig, ServiceSelection, Opening, ExtraItem, Adjustment };

export interface Company {
  name: string;
  whatsapp: string;
  city: string;
  paymentTerms: string;
  hoursPerDay: number;
  marginPct: number;
  /** Quanto o pintor quer ganhar por dia; vira custo/hora da equipe. */
  dailyRateCents: number;
  safetyDays: number;
  pricingMode: EngineConfig["pricingMode"];
  marginMode: EngineConfig["marginMode"];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export type QuoteStatus = "open" | "won" | "lost";

export interface Quote {
  id: string;
  number: number;
  clientId: string;
  siteAddress: string;
  visitId?: string;
  status: QuoteStatus;
  createdAt: string;
  validUntil: string;
  closedAt?: string;
  paymentTerms: string;
  notes: string;
  input: QuoteInput;
  /** Regras usadas no cálculo (para reproduzir depois, mesmo se os preços mudarem). */
  configSnapshot: EngineConfig;
  engineVersion: string;
  result: QuoteResult;
}

export type WorkStatus = "scheduled" | "in_progress" | "issues" | "done";

export interface Work {
  id: string;
  quoteId: string;
  clientId: string;
  title: string;
  status: WorkStatus;
  createdAt: string;
  plannedDays: number;
  plannedHours: number;
  plannedTotalCents: number;
  plannedCostCents: number;
  /** Campos "realizado" reservados para comparar orçado × realizado no futuro. */
  actual?: { hours?: number; costCents?: number; endDate?: string };
}

export interface Visit {
  id: string;
  clientId: string;
  siteAddress: string;
  notes: string;
  /** Ids das fotos (arquivos ficam no aparelho; ver repositories/photoStore.ts). */
  photoIds: string[];
  createdAt: string;
  quoteId?: string;
}

export interface Db {
  version: 1;
  company: Company | null;
  services: ServiceConfig[];
  materials: MaterialConfig[];
  enabledServiceIds: string[];
  clients: Client[];
  visits: Visit[];
  quotes: Quote[];
  works: Work[];
  counters: { quote: number };
}
