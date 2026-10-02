import type { MaterialConfig, ServiceConfig } from "./types";

/**
 * VALORES DE DEMONSTRAÇÃO (isDemo). O documento mestre ainda não define produtividade,
 * rendimento, perdas e preços; o pintor deve conferir tudo em Configurações.
 */
const svc = (s: Omit<ServiceConfig, "isDemo">): ServiceConfig => ({ ...s, isDemo: true });
const mat = (m: Omit<MaterialConfig, "isDemo">): MaterialConfig => ({ ...m, isDemo: true });

export const DEFAULT_SERVICES: ServiceConfig[] = [
  svc({ id: "protecao", clientText: "Proteger pisos e móveis com lona", name: "Proteção do ambiente", unit: "un", basis: "room_count", salePriceCents: 5000, productivityPerHour: 1, usesCoats: false, defaultCoats: 1, materialIds: ["lona"] }),
  svc({ id: "protecao_vaos", clientText: "Proteger portas e janelas com fita", name: "Proteção de portas e janelas", unit: "ml", basis: "opening_perimeter", salePriceCents: 300, productivityPerHour: 20, usesCoats: false, defaultCoats: 1, materialIds: ["fita"] }),
  svc({ id: "raspagem", clientText: "Raspar e remover a tinta solta das paredes", name: "Raspagem / remoção de tinta", unit: "m2", basis: "walls_area", salePriceCents: 600, productivityPerHour: 8, usesCoats: false, defaultCoats: 1, materialIds: ["lixa"] }),
  svc({ id: "correcao", clientText: "Corrigir trincas e pequenas falhas", name: "Correção de trincas", unit: "m2", basis: "walls_area", salePriceCents: 400, productivityPerHour: 15, usesCoats: false, defaultCoats: 1, materialIds: ["massa_acrilica"] }),
  svc({ id: "massa_corrida", clientText: "Aplicar massa corrida nas paredes", name: "Massa corrida", unit: "m2", basis: "walls_area", salePriceCents: 1200, productivityPerHour: 6, usesCoats: true, defaultCoats: 2, materialIds: ["massa_corrida"] }),
  svc({ id: "massa_acrilica", clientText: "Aplicar massa acrílica nas paredes", name: "Massa acrílica", unit: "m2", basis: "walls_area", salePriceCents: 1000, productivityPerHour: 6, usesCoats: true, defaultCoats: 2, materialIds: ["massa_acrilica"] }),
  svc({ id: "lixamento", clientText: "Lixar as paredes", name: "Lixamento", unit: "m2", basis: "walls_area", salePriceCents: 400, productivityPerHour: 15, usesCoats: false, defaultCoats: 1, materialIds: ["lixa"] }),
  svc({ id: "selador", clientText: "Aplicar selador nas paredes", name: "Selador / fundo preparador", unit: "m2", basis: "walls_area", salePriceCents: 500, productivityPerHour: 20, usesCoats: true, defaultCoats: 1, materialIds: ["selador"] }),
  svc({ id: "pintura_parede", clientText: "Pintar as paredes, {demaos}", name: "Pintura de paredes", unit: "m2", basis: "walls_area", salePriceCents: 1800, productivityPerHour: 12, usesCoats: true, defaultCoats: 2, materialIds: ["tinta"] }),
  svc({ id: "pintura_teto", clientText: "Pintar o teto, {demaos}", name: "Pintura de teto", unit: "m2", basis: "ceiling_area", salePriceCents: 2000, productivityPerHour: 10, usesCoats: true, defaultCoats: 2, materialIds: ["tinta"] }),
  svc({ id: "textura", clientText: "Aplicar textura nas paredes", name: "Textura / grafiato", unit: "m2", basis: "walls_area", salePriceCents: 2500, productivityPerHour: 5, usesCoats: false, defaultCoats: 1, materialIds: ["textura"] }),
  svc({ id: "portas", clientText: "Pintar as portas, {demaos}", name: "Pintura de portas", unit: "un", basis: "door_count", salePriceCents: 12000, productivityPerHour: 0.5, usesCoats: true, defaultCoats: 2, materialIds: ["esmalte"] }),
  svc({ id: "janelas", clientText: "Pintar as janelas, {demaos}", name: "Pintura de janelas", unit: "un", basis: "window_count", salePriceCents: 10000, productivityPerHour: 0.5, usesCoats: true, defaultCoats: 2, materialIds: ["esmalte"] }),
  svc({ id: "rodape", clientText: "Pintar os rodapés, {demaos}", name: "Rodapés", unit: "ml", basis: "baseboard_length", salePriceCents: 800, productivityPerHour: 15, usesCoats: true, defaultCoats: 2, materialIds: ["esmalte"] }),
  svc({ id: "grades", clientText: "Pintar grades e estruturas, {demaos}", name: "Grades / estruturas", unit: "un", basis: "fixed", salePriceCents: 15000, productivityPerHour: 0.5, usesCoats: true, defaultCoats: 2, materialIds: ["esmalte"] }),
];

export const DEFAULT_MATERIALS: MaterialConfig[] = [
  mat({ id: "tinta", name: "Tinta acrílica", unit: "L", priceCents: 1500, yieldPerUnit: 10, wastePct: 10 }),
  mat({ id: "esmalte", name: "Esmalte", unit: "L", priceCents: 3000, yieldPerUnit: 12, wastePct: 10 }),
  mat({ id: "massa_corrida", name: "Massa corrida", unit: "kg", priceCents: 600, yieldPerUnit: 2.5, wastePct: 10 }),
  mat({ id: "massa_acrilica", name: "Massa acrílica", unit: "kg", priceCents: 800, yieldPerUnit: 2.5, wastePct: 10 }),
  mat({ id: "selador", name: "Selador", unit: "L", priceCents: 1200, yieldPerUnit: 12, wastePct: 10 }),
  mat({ id: "textura", name: "Textura", unit: "kg", priceCents: 500, yieldPerUnit: 1.5, wastePct: 10 }),
  mat({ id: "lixa", name: "Lixa", unit: "un", priceCents: 300, yieldPerUnit: 10, wastePct: 0, packSize: 1 }),
  mat({ id: "fita", name: "Fita crepe", unit: "rolo", priceCents: 1000, yieldPerUnit: 50, wastePct: 0, packSize: 1 }),
  mat({ id: "lona", name: "Lona / plástico", unit: "un", priceCents: 1500, yieldPerUnit: 1, wastePct: 0, packSize: 1 }),
];

export const WALL_CONDITIONS = [
  { id: "nova", label: "Nova (nunca pintada)", services: ["protecao", "protecao_vaos", "selador", "pintura_parede"] },
  { id: "pintada", label: "Já pintada, boa", services: ["protecao", "protecao_vaos", "lixamento", "pintura_parede"] },
  { id: "descascando", label: "Descascando", services: ["protecao", "protecao_vaos", "raspagem", "correcao", "selador", "pintura_parede"] },
  { id: "trincas", label: "Com trincas", services: ["protecao", "protecao_vaos", "correcao", "massa_corrida", "lixamento", "selador", "pintura_parede"] },
] as const;

/** Serviços sugeridos para um estado de parede, limitados aos que o pintor oferece. */
export const suggestServices = (conditionId: string, enabled: string[]): string[] => {
  const c = WALL_CONDITIONS.find((w) => w.id === conditionId);
  return (c?.services ?? []).filter((id) => enabled.includes(id));
};

/** Frase do serviço para o cliente. Contas antigas (sem `clientText` salvo) usam o texto padrão do catálogo. */
export function clientTextFor(svc: { id: string; name: string; clientText?: string }, coats: number): string {
  const base = svc.clientText ?? DEFAULT_SERVICES.find((d) => d.id === svc.id)?.clientText ?? svc.name;
  return base.replace("{demaos}", `${coats} ${coats === 1 ? "demão" : "demãos"}`);
}

/** Serviços de preparação (para o resumo do PDF) e ordem em que aparecem (do preparo à pintura). */
export const PREP_SERVICE_IDS = ["protecao", "protecao_vaos", "raspagem", "correcao", "massa_corrida", "massa_acrilica", "lixamento", "selador"];
export const serviceOrder = (id: string): number => {
  const i = DEFAULT_SERVICES.findIndex((s) => s.id === id);
  return i === -1 ? 999 : i;
};

/** As 6 cores que o pintor pode escolher para o PDF (contraste conferido pelo designer). */
export const PDF_COLORS = [
  { hex: "#0F3B7A", name: "Azul" },
  { hex: "#0B7F44", name: "Verde" },
  { hex: "#B3261E", name: "Vermelho" },
  { hex: "#A24A00", name: "Laranja" },
  { hex: "#6B3FA0", name: "Roxo" },
  { hex: "#2B3440", name: "Grafite" },
] as const;

/** Textos sugeridos (o pintor edita em Ajustes). Um item por linha. */
export const DEFAULT_PDF_TEXTS = {
  exclusionsText: "Retirada e recolocação de móveis.\nReparos de reboco ou de infiltração que não estejam listados.",
  beforeStartText: "Liberar o acesso aos ambientes.\nRetirar ou cobrir móveis e objetos frágeis.",
  warrantyText: "12 meses para o serviço executado, exceto em caso de infiltração, umidade ou mau uso.",
} as const;
