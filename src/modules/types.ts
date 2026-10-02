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
  // ---- PDF do orçamento (todos opcionais: contas antigas usam os padrões) ----
  ownerName?: string;
  /** Uma das cores de PDF_COLORS. */
  brandColor?: string;
  /** Id do arquivo (IndexedDB/nuvem) com o logo do pintor; sem ele o PDF usa as iniciais. */
  logoId?: string;
  /** Um item por linha. */
  exclusionsText?: string;
  beforeStartText?: string;
  warrantyText?: string;
  /** % da entrada sugerida no botão de pagamento do PDF. */
  depositPct?: number;
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
  /** Quantas vezes foi editado depois de salvo (0/ausente = original). */
  revision?: number;
  revisedAt?: string;
  /** PDF: mostrar o valor de cada ambiente. */
  showRoomPrices?: boolean;
  /** PDF: link para o cliente pagar a entrada (Pix/cartão do próprio pintor). Sem link, o bloco não aparece. */
  paymentLink?: string;
  depositPct?: number;
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

/** Marca feita pelo pintor durante a gravação (ex.: "📍 Medida" aos 0:42). */
export interface AudioMarker {
  t: number;
  label: string;
}

export interface AudioNote {
  id: string;
  seconds: number;
  createdAt: string;
  mime: string;
  markers?: AudioMarker[];
}

/** Medidas anotadas na visita; viram ambientes do orçamento. */
export interface VisitRoom {
  id: string;
  name: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  condition: string;
  doors: number;
  windows: number;
}

export interface Visit {
  id: string;
  /** Pode faltar: a visita rápida começa sem cliente e ele é definido depois. */
  clientId?: string;
  /** Medidas anotadas na visita (viram os ambientes do orçamento). */
  rooms?: VisitRoom[];
  /** Visita agendada (ISO). Sem `startedAt` = ainda não aconteceu. */
  scheduledAt?: string;
  /** Quando a visita foi iniciada (visitas rápidas já nascem iniciadas). */
  startedAt?: string;
  /** O pintor confirmou que avisou o cliente sobre a gravação. */
  recordingConsent?: boolean;
  siteAddress: string;
  notes: string;
  /** Ids das fotos (arquivos ficam no aparelho; ver repositories/photoStore.ts). */
  photoIds: string[];
  /** Fotos escolhidas para o PDF (por id), com legenda e ambiente. */
  photoMeta?: Record<string, { inPdf?: boolean; caption?: string; room?: string }>;
  /** Gravações de áudio (arquivos ficam no aparelho). */
  audios?: AudioNote[];
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
