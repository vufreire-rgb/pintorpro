import { measureRoom, quantityForBasis } from "./measure";
import type { PaintType } from "./types";

export const PAINT_LABEL: Record<PaintType, string> = { acrilica: "Acrílica", esmalte: "Esmalte", piso: "Piso", grafiato: "Grafiato", cimento_queimado: "Cimento queimado" };
import type {
  EngineConfig,
  MaterialLine,
  QuoteInput,
  QuoteResult,
  ServiceLine,
} from "./types";

export const ENGINE_VERSION = "0.1.0";

const roundCents = (n: number) => Math.round(n);
const up2 = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;

/** Função pura: mesmo input + mesma config = mesmo resultado. */
export function calculateQuote(input: QuoteInput, config: EngineConfig): QuoteResult {
  const warnings: string[] = [];
  const services = new Map(config.services.map((s) => [s.id, s]));
  const materials = new Map(config.materials.map((m) => [m.id, m]));
  const measures = input.rooms.map(measureRoom);

  const serviceLines: ServiceLine[] = [];
  /** materialId -> quantidade necessária, ainda sem perda/embalagem */
  const needed = new Map<string, number>();
  let totalHours = 0;

  input.rooms.forEach((room, i) => {
    const m = measures[i]!;
    for (const sel of room.services) {
      const svc = services.get(sel.serviceId);
      if (!svc) {
        warnings.push(`Serviço "${sel.serviceId}" não existe na configuração.`);
        continue;
      }
      const quantity = sel.quantityOverride ?? quantityForBasis(svc.basis, m, svc);
      if (quantity <= 0) continue;
      const coats = svc.usesCoats ? (sel.coats ?? svc.defaultCoats) : 1;

      let hours = 0;
      if (svc.unit === "diaria") hours = quantity * config.hoursPerDay;
      else if (svc.productivityPerHour && svc.productivityPerHour > 0)
        hours = (quantity * coats) / svc.productivityPerHour;
      else warnings.push(`"${svc.name}" sem produtividade: horas não estimadas.`);
      if (svc.isDemo) warnings.push(`"${svc.name}" usa valores de demonstração.`);

      totalHours += hours;
      serviceLines.push({
        roomId: room.id,
        roomName: room.name,
        serviceId: svc.id,
        name: svc.name,
        unit: svc.unit,
        quantity,
        coats,
        unitPriceCents: svc.salePriceCents,
        totalCents: roundCents(quantity * svc.salePriceCents),
        hours,
        laborCostCents: roundCents(hours * config.crew.hourlyCostCents),
      });

      for (const materialId of svc.materialIds) {
        needed.set(materialId, (needed.get(materialId) ?? 0) + (quantity * coats) / yieldOf(materialId));
      }
    }
  });

  // Superfície medida com um tipo de pintura que nenhum serviço escolhido cobre: avisa, para não ficar de fora do preço.
  input.rooms.forEach((room, i) => {
    const by = measures[i]!.byPaint;
    if (!by) return;
    for (const p of Object.keys(by) as (keyof typeof by)[]) {
      const total = by[p].walls + by[p].ceiling + by[p].floor;
      if (total <= 0) continue;
      const covered = room.services.some((sel) => services.get(sel.serviceId)?.paint === p);
      if (!covered) warnings.push(`${room.name}: há medidas em ${PAINT_LABEL[p]} sem o serviço correspondente escolhido.`);
    }
  });

  function yieldOf(materialId: string): number {
    return input.yieldOverrides?.[materialId] ?? materials.get(materialId)?.yieldPerUnit ?? 1;
  }

  const materialLines: MaterialLine[] = [];
  for (const [materialId, rawQty] of needed) {
    const mat = materials.get(materialId);
    if (!mat) {
      warnings.push(`Material "${materialId}" não existe na configuração.`);
      continue;
    }
    if (mat.isDemo) warnings.push(`"${mat.name}" usa valores de demonstração.`);
    const withWaste = rawQty * (1 + mat.wastePct / 100);
    const purchaseQty = mat.packSize ? Math.ceil(withWaste / mat.packSize - 1e-9) * mat.packSize : up2(withWaste);
    materialLines.push({
      materialId,
      name: mat.name,
      unit: mat.unit,
      neededQty: up2(rawQty),
      purchaseQty,
      unitPriceCents: mat.priceCents,
      costCents: roundCents(purchaseQty * mat.priceCents),
      included: input.materialsIncluded?.[materialId] ?? true,
      yieldUsed: yieldOf(materialId),
    });
  }

  const servicesCents = sum(serviceLines.map((l) => l.totalCents));
  const laborCostCents = sum(serviceLines.map((l) => l.laborCostCents));
  const materialsCents = sum(materialLines.filter((l) => l.included).map((l) => l.costCents));
  const extrasPriceCents = sum(input.extras.map((e) => e.priceCents));
  const extrasCostCents = sum(input.extras.map((e) => e.costCents));
  const costCents = laborCostCents + materialsCents + extrasCostCents;

  let subtotalCents: number;
  if (config.pricingMode === "cost_plus") {
    const m = config.marginPct / 100;
    if (config.marginMode === "on_price") {
      if (m >= 1) throw new RangeError("Margem sobre a venda deve ser menor que 100%.");
      subtotalCents = roundCents(costCents / (1 - m));
    } else subtotalCents = roundCents(costCents * (1 + m));
  } else subtotalCents = servicesCents + materialsCents + extrasPriceCents;

  const adj = input.adjustment;
  let adjustmentCents = 0;
  if (adj && adj.value > 0) {
    const abs = adj.mode === "percent" ? roundCents((subtotalCents * adj.value) / 100) : roundCents(adj.value);
    adjustmentCents = adj.type === "discount" ? -abs : abs;
  }
  const totalCents = Math.max(0, subtotalCents + adjustmentCents);
  const profitCents = totalCents - costCents;

  const crew = Math.max(1, config.crew.workers);
  const workDays = totalHours > 0 ? Math.ceil(totalHours / (config.hoursPerDay * crew) - 1e-9) : 0;

  return {
    measures,
    serviceLines,
    materialLines,
    extras: input.extras,
    totals: {
      servicesCents,
      materialsCents,
      extrasPriceCents,
      subtotalCents,
      adjustmentCents,
      totalCents,
      costCents,
      laborCostCents,
      profitCents,
      profitMargin: totalCents > 0 ? profitCents / totalCents : 0,
    },
    schedule: { hours: totalHours, workDays, safetyDays: config.safetyDays, totalDays: workDays + config.safetyDays },
    warnings: [...new Set(warnings)],
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
