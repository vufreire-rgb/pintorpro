/** Tipos do motor de orçamento. Este módulo é puro: nada de UI, banco ou relógio. */

export type BillingUnit = "m2" | "ml" | "un" | "diaria" | "fechado";

/** De onde vem a quantidade de um serviço. Novas bases entram em `quantityForBasis`. */
export type QuantityBasis =
  | "walls_area"
  | "ceiling_area"
  | "baseboard_length"
  | "door_count"
  | "window_count"
  | "opening_perimeter"
  | "room_count"
  | "fixed";

export interface MaterialConfig {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  /** Quantas unidades de serviço (ex.: m²) rende 1 unidade do material (ex.: 1 L). Editável. */
  yieldPerUnit: number;
  wastePct: number;
  /** Compra em múltiplos desta embalagem (ex.: 18 L). Vazio = sem arredondamento. */
  packSize?: number;
  isDemo?: boolean;
}

export interface ServiceConfig {
  id: string;
  name: string;
  unit: BillingUnit;
  basis: QuantityBasis;
  /** Preço cobrado do cliente por unidade (mão de obra). */
  salePriceCents: number;
  /** Unidades de serviço por hora de UMA pessoa. null = não estimado. */
  productivityPerHour: number | null;
  /** Se true, demãos multiplicam material e horas. */
  usesCoats: boolean;
  defaultCoats: number;
  materialIds: string[];
  /** Frase mostrada ao cliente no PDF. Aceita {demaos} (ex.: "2 demãos"). */
  clientText?: string;
  isDemo?: boolean;
}

export interface EngineConfig {
  services: ServiceConfig[];
  materials: MaterialConfig[];
  crew: { workers: number; hourlyCostCents: number };
  hoursPerDay: number;
  safetyDays: number;
  /** base_price: cobra preço-base dos serviços. cost_plus: custo + margem. */
  pricingMode: "base_price" | "cost_plus";
  /** on_price: margem sobre a venda. markup: percentual sobre o custo. */
  marginMode: "on_price" | "markup";
  /** Usado em cost_plus. Ex.: 30 = 30%. */
  marginPct: number;
}

export interface Opening {
  kind: "door" | "window";
  widthM: number;
  heightM: number;
  qty: number;
  deductFromArea: boolean;
  protectPerimeter: boolean;
}

export interface ServiceSelection {
  serviceId: string;
  coats?: number;
  /** Para serviços "fixed"/diária: quantidade informada. */
  quantityOverride?: number;
}

export interface Room {
  id: string;
  name: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  /** Estado atual das paredes (nova, pintada, descascando, trincas...). Guardado para análises futuras. */
  wallCondition?: string;
  openings: Opening[];
  services: ServiceSelection[];
}

export interface ExtraItem {
  description: string;
  priceCents: number;
  costCents: number;
}

export interface Adjustment {
  type: "discount" | "surcharge";
  mode: "percent" | "cents";
  value: number;
}

export interface QuoteInput {
  rooms: Room[];
  extras: ExtraItem[];
  /** materialId -> false quando o cliente fornece o material. */
  materialsIncluded?: Record<string, boolean>;
  /** materialId -> rendimento alterado no orçamento. */
  yieldOverrides?: Record<string, number>;
  adjustment?: Adjustment;
}

export interface RoomMeasures {
  roomId: string;
  wallsGrossM2: number;
  wallsNetM2: number;
  ceilingM2: number;
  baseboardM: number;
  doorCount: number;
  windowCount: number;
  openingPerimeterM: number;
}

export interface ServiceLine {
  roomId: string;
  roomName: string;
  serviceId: string;
  name: string;
  unit: BillingUnit;
  quantity: number;
  coats: number;
  unitPriceCents: number;
  totalCents: number;
  hours: number;
  laborCostCents: number;
}

export interface MaterialLine {
  materialId: string;
  name: string;
  unit: string;
  neededQty: number;
  purchaseQty: number;
  unitPriceCents: number;
  costCents: number;
  included: boolean;
  yieldUsed: number;
}

export interface QuoteResult {
  measures: RoomMeasures[];
  serviceLines: ServiceLine[];
  materialLines: MaterialLine[];
  extras: ExtraItem[];
  totals: {
    servicesCents: number;
    materialsCents: number;
    extrasPriceCents: number;
    subtotalCents: number;
    adjustmentCents: number;
    totalCents: number;
    costCents: number;
    laborCostCents: number;
    profitCents: number;
    /** Lucro ÷ preço (0–1). */
    profitMargin: number;
  };
  schedule: { hours: number; workDays: number; safetyDays: number; totalDays: number };
  warnings: string[];
}
