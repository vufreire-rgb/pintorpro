"use client";
import { useRef, useState } from "react";
import { LinkButton, Button, Card, Chip, Field, Loading, NumberInput, Screen, TextArea, TextInput } from "@/components/ui";
import { DEFAULT_PDF_TEXTS, PDF_COLORS } from "@/modules/catalog";
import { cloudEnabled, logout, useAuthState } from "@/modules/auth";
import { removePhotoFile, storeLogo, useFileUrl } from "@/modules/photos";
import { saveCompany, setEnabledServices, updateMaterial, updateService } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";

function LogoPreview({ id }: { id: string }) {
  const url = useFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="Seu logo" className="h-20 w-20 rounded-xl border border-slate-200 bg-white object-contain" /> : <div className="h-20 w-20 rounded-xl bg-slate-100" />;
}

export default function Configuracoes() {
  const db = useAppDb();
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoMsg, setLogoMsg] = useState("");
  const auth = useAuthState();
  if (!db) return <Loading />;
  const c = db.company!;
  const set = (patch: Partial<typeof c>) => saveCompany({ ...c, ...patch });
  return (
    <Screen title="Ajustes" nav>
      <LinkButton href="/clientes" variant="ghost">👥 Meus clientes</LinkButton>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Seu negócio</h2>
        <Field label="Nome"><TextInput value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="WhatsApp"><TextInput value={c.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="Cidade"><TextInput value={c.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Condição de pagamento padrão"><TextInput value={c.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Seu orçamento em PDF</h2>
        <Field label="Seu nome (aparece no PDF)" hint="Opcional. Ex.: Carlos Silva"><TextInput value={c.ownerName ?? ""} onChange={(e) => set({ ownerName: e.target.value })} /></Field>
        <div className="flex flex-col gap-3">
          <p className="font-medium">Seu logo</p>
          <div className="flex items-center gap-4">
            {c.logoId ? <LogoPreview id={c.logoId} /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-brand text-sm text-white">sem logo</div>}
            <div className="flex flex-1 flex-col gap-2">
              <Button variant="ghost" onClick={() => logoInput.current?.click()}>{c.logoId ? "Trocar logo" : "Enviar meu logo"}</Button>
              {c.logoId ? <button className="min-h-10 text-red-700 underline" onClick={() => { void removePhotoFile(c.logoId!); set({ logoId: undefined }); }}>Remover logo</button> : null}
            </div>
          </div>
          <input ref={logoInput} type="file" accept="image/*" hidden data-testid="logo-input" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setLogoMsg("");
            try { const old = c.logoId; const id = await storeLogo(f); set({ logoId: id }); if (old) void removePhotoFile(old); } catch { setLogoMsg("Não consegui ler essa imagem. Tente outra (PNG ou JPG)."); }
          }} />
          {logoMsg ? <p className="text-sm text-red-700">{logoMsg}</p> : <p className="text-sm text-slate-500">Aparece no topo do PDF. Sem logo, usamos as iniciais do seu negócio.</p>}
        </div>
        <div>
          <p className="mb-2 font-medium">Cor do app e do PDF</p>
          <div className="flex flex-wrap gap-3">
            {PDF_COLORS.map((col) => (
              <button
                key={col.hex}
                type="button"
                onClick={() => set({ brandColor: col.hex })}
                aria-label={col.name}
                aria-pressed={(c.brandColor ?? "#0F3B7A") === col.hex}
                className={`grid h-12 w-12 place-items-center rounded-full text-xl text-white ${(c.brandColor ?? "#0F3B7A") === col.hex ? "ring-4 ring-slate-300" : ""}`}
                style={{ backgroundColor: col.hex }}
              >
                {(c.brandColor ?? "#0F3B7A") === col.hex ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>
        <Field label="Entrada sugerida (%)" hint="Usada no botão de pagar do PDF, quando você coloca o link de pagamento."><NumberInput value={c.depositPct ?? 50} onChange={(n) => set({ depositPct: Math.min(100, Math.max(1, n || 50)) })} /></Field>
        <Field label="O que não está incluso" hint="Um item por linha."><TextArea value={c.exclusionsText ?? DEFAULT_PDF_TEXTS.exclusionsText} onChange={(e) => set({ exclusionsText: e.target.value })} /></Field>
        <Field label="Antes de começar (o que o cliente faz)" hint="Um item por linha."><TextArea value={c.beforeStartText ?? DEFAULT_PDF_TEXTS.beforeStartText} onChange={(e) => set({ beforeStartText: e.target.value })} /></Field>
        <Field label="Garantia"><TextArea value={c.warrantyText ?? DEFAULT_PDF_TEXTS.warrantyText} onChange={(e) => set({ warrantyText: e.target.value })} /></Field>
        <p className="text-sm text-slate-500">Esses textos são sugestões. Troque pelo que você realmente combina com seus clientes.</p>
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
      {cloudEnabled && auth.status === "ready" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Conta</h2>
          <p className="text-slate-600">{auth.email}</p>
          <Button variant="ghost" onClick={() => logout()}>Sair</Button>
        </Card>
      ) : null}
    </Screen>
  );
}
