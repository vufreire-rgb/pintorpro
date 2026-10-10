import type { EngineConfig, QuoteInput, QuoteResult, Room, ServiceConfig, MaterialConfig, ServiceSelection, Opening, ExtraItem, Adjustment, Surface, PaintType } from "@/engine";
import type { PixConfig } from "./pix";

export type { EngineConfig, QuoteInput, QuoteResult, Room, ServiceConfig, MaterialConfig, ServiceSelection, Opening, ExtraItem, Adjustment, Surface, PaintType };

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
  /** Lembrete de revisar orçamentos: hora "HH:MM" e dias da semana (0=domingo … 6=sábado). */
  /** Chave Pix do pintor, para gerar o "copia e cola" e o QR. */
  pix?: PixConfig;
  reviewReminder?: { time: string; days: number[] };
  /** Um item por linha. */
  exclusionsText?: string;
  beforeStartText?: string;
  warrantyText?: string;
  /** % da entrada sugerida no botão de pagamento do PDF. */
  depositPct?: number;
  /** Link de pagamento (cartão) do próprio pintor, usado nos orçamentos novos. O dinheiro vai direto para a conta dele. */
  paymentLink?: string;
  /** Já oferecemos cadastrar a chave Pix (e a pessoa disse "agora não"). */
  pixAsked?: boolean;
  /** Já perguntamos se a pessoa quer os avisos de "cliente abriu o orçamento". */
  pushAsked?: boolean;
  /** O pintor dispensou a lista de primeiros passos. */
  stepsHidden?: boolean;
  /** Como o pintor orça: "calc" (padrão) usa a base de cálculo; "simple" só voz e preço fechado, sem telas de cálculo. */
  quoteMode?: "calc" | "simple";
  /** false = conta nova que ainda não escolheu o jeito de orçar (a escolha aparece no primeiro "Novo orçamento"). */
  quoteModeAsked?: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  /** Cliente criado pelo guia de treino; some junto com a visita de exemplo. */
  isExample?: boolean;
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
  /** Lista de materiais da obra, escrita ou ditada pelo pintor (um item por linha). Serve para o pintor e para a loja de tintas. */
  materialsText?: string;
  /** Mostrar a lista de materiais no PDF e no link do cliente (padrão: não). */
  showMaterials?: boolean;
  /** PDF: link para o cliente pagar a entrada (Pix/cartão do próprio pintor). Sem link, o bloco não aparece. */
  paymentLink?: string;
  depositPct?: number;
  /** Como o cliente pode pagar a entrada. Ausente = oferece o que estiver cadastrado. */
  payPix?: boolean;
  payCard?: boolean;
  status: QuoteStatus;
  createdAt: string;
  validUntil: string;
  closedAt?: string;
  /** Perdido sozinho (ficou sem resposta bem depois da validade). Some ao reabrir. */
  autoClosed?: boolean;
  paymentTerms: string;
  notes: string;
  input: QuoteInput;
  /** Regras usadas no cálculo (para reproduzir depois, mesmo se os preços mudarem). */
  configSnapshot: EngineConfig;
  engineVersion: string;
  result: QuoteResult;
}

export type WorkStatus = "scheduled" | "in_progress" | "issues" | "done";

export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "transferencia" | "outro";

export interface Payment {
  id: string;
  /** AAAA-MM-DD */
  date: string;
  amountCents: number;
  note: string;
  method?: PaymentMethod;
  /** Foto do comprovante (arquivo guardado como as fotos da visita). */
  proofId?: string;
}

export type ExpenseKind = "material" | "ajudante" | "transporte" | "outro";

/** Gasto real da obra (nota de tinta, ajudante, gasolina…). */
export interface Expense {
  id: string;
  /** AAAA-MM-DD */
  date: string;
  kind: ExpenseKind;
  amountCents: number;
  note: string;
}

/** Parcela combinada com o cliente. */
export interface Installment {
  id: string;
  label: string;
  /** AAAA-MM-DD */
  dueDate: string;
  amountCents: number;
}

/** Marca desenhada pelo pintor em cima de uma foto. Coordenadas de 0 a 1 (independem do tamanho da foto). */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** Precisão do GPS, em metros. */
  accuracy?: number;
}

export interface PhotoMark {
  id: string;
  kind: "text" | "arrow" | "dim";
  color: string;
  x1: number;
  y1: number;
  /** Seta e cota: ponto final. Texto: igual ao ponto inicial. */
  x2: number;
  y2: number;
  /** Texto escrito, ou o valor da medida (cota). */
  text: string;
}

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
  /** Datas combinadas (AAAA-MM-DD, dia local). */
  startDate?: string;
  endDate?: string;
  /** Pagamentos recebidos do cliente. */
  payments?: Payment[];
  /** Gastos reais da obra, para comparar lucro previsto × real. */
  expenses?: Expense[];
  /** A pessoa reabriu a obra de propósito: o app não a conclui sozinho de novo. */
  keepOpen?: boolean;
  /** Obra de treino criada pelo guia; fica fora dos números do painel. */
  isExample?: boolean;
  /** Dias que o pintor realmente trabalhou na obra. */
  daysWorked?: number;
  /** Plano de pagamento combinado (parcelas). */
  plan?: Installment[];
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
  /** Medidas por parede/teto/piso. Sem isto, vale comprimento × largura × altura (visitas antigas). */
  surfaces?: Surface[];
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
  /** Ponto no mapa marcado pelo pintor com "Usar minha localização". */
  location?: GeoPoint;
  photoMeta?: Record<string, { inPdf?: boolean; caption?: string; room?: string; marks?: PhotoMark[] }>;
  /** Gravações de áudio (arquivos ficam no aparelho). */
  audios?: AudioNote[];
  createdAt: string;
  quoteId?: string;
  /** Visita de treino criada pelo guia. */
  isExample?: boolean;
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
