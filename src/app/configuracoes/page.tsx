"use client";
import { Card, Chip, Field, Loading, NumberInput, Screen, TextInput } from "@/components/ui";
import { saveCompany, setEnabledServices, updateMaterial, updateService } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";

export default function Configuracoes() {
  const db = useAppDb();
  if (!db) return <Loading />;
  const c = db.company!;
  const set = (patch: Partial<typeof c>) => saveCompany({ ...c, ...patch });
  return (
    <Screen title="Ajustes" nav>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Seu negócio</h2>
        <Field label="Nome"><TextInput value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="WhatsApp"><TextInput value={c.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="Cidade"><TextInput value={c.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Condição de pagamento padrão"><TextInput value={c.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Custos e lucro</h2>
        <Field label="Diária que você quer ganhar (R$)"><NumberInput value={c.dailyRateCents / 100} onChange={(n) => set({ dailyRateCents: toCents(n) })} /></Field>
        <Field label="Horas de trabalho por dia"><NumberInput value={c.hoursPerDay} onChange={(n) => set({ hoursPerDay: n || 8 })} /></Field>
        <Field label="Dias de segurança no prazo"><NumberInput value={c.safetyDays} onChange={(n) => set({ safetyDays: n })} /></Field>
        <Field label="Margem desejada (%)"><NumberInput value={c.marginPct} onChange={(n) => set({ marginPct: Math.min(n, 95) })} /></Field>
        <div>
          <p className="mb-2 font-medium">Como calcular o preço?</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={c.pricingMode === "base_price"} onClick={() => set({ pricingMode: "base_price" })}>Pelo meu preço por serviço</Chip>
            <Chip active={c.pricingMode === "cost_plus"} onClick={() => set({ pricingMode: "cost_plus" })}>Custo + margem</Chip>
          </div>
        </div>
        {c.pricingMode === "cost_plus" ? (
          <div className="flex flex-wrap gap-2">
            <Chip active={c.marginMode === "on_price"} onClick={() => set({ marginMode: "on_price" })}>Margem sobre a venda</Chip>
            <Chip active={c.marginMode === "markup"} onClick={() => set({ marginMode: "markup" })}>Markup sobre o custo</Chip>
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Serviços e preços</h2>
        {db.services.map((s) => {
          const on = db.enabledServiceIds.includes(s.id);
          return (
            <div key={s.id} className="flex flex-col gap-2 border-b border-slate-100 pb-3">
              <Chip active={on} onClick={() => setEnabledServices(on ? db.enabledServiceIds.filter((x) => x !== s.id) : [...db.enabledServiceIds, s.id])}>{s.name}</Chip>
              {on ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`Preço (R$/${UNIT_LABEL[s.unit]})`}><NumberInput value={s.salePriceCents / 100} onChange={(n) => updateService(s.id, { salePriceCents: toCents(n) })} /></Field>
                  <Field label={`Produção (${UNIT_LABEL[s.unit]}/hora)`}><NumberInput value={s.productivityPerHour ?? 0} onChange={(n) => updateService(s.id, { productivityPerHour: n > 0 ? n : null })} /></Field>
                </div>
              ) : null}
              {on && s.isDemo ? <span className="text-sm text-amber-700">Valor de exemplo — confira</span> : null}
            </div>
          );
        })}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Materiais</h2>
        {db.materials.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 border-b border-slate-100 pb-3">
            <div className="font-medium">{m.name} ({m.unit}){m.isDemo ? <span className="ml-2 text-sm text-amber-700">exemplo</span> : null}</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Preço R$"><NumberInput value={m.priceCents / 100} onChange={(n) => updateMaterial(m.id, { priceCents: toCents(n) })} /></Field>
              <Field label="Rende"><NumberInput value={m.yieldPerUnit} onChange={(n) => updateMaterial(m.id, { yieldPerUnit: n > 0 ? n : 1 })} /></Field>
              <Field label="Perda %"><NumberInput value={m.wastePct} onChange={(n) => updateMaterial(m.id, { wastePct: n })} /></Field>
            </div>
          </div>
        ))}
        <p className="text-sm text-slate-500">&quot;Rende&quot; = quantos m² (ou metros/unidades) 1 unidade do material cobre.</p>
      </Card>
    </Screen>
  );
}
