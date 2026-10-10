"use client";
import { useRef, useState } from "react";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { InstallBanner } from "@/components/InstallBanner";
import { Button, Card, ConfirmDialog, Section, SectionGroup, SectionLink, Chip, Field, Loading, NumberInput, Screen, TextArea, TextInput } from "@/components/ui";
import { DEFAULT_PDF_TEXTS, PDF_COLORS } from "@/modules/catalog";
import { cloudEnabled, useAuthState } from "@/modules/auth";
import { downloadMyData, prepareLogout, signOutAndWipe } from "@/modules/account";
import { BrandHeader } from "@/components/BrandHeader";
import { PixModal } from "@/components/PixModal";
import { normalizePixKey, pixPayload } from "@/modules/pix";
import { validPaymentLink } from "@/components/PaymentOptionsField";
import { PixKeyInput } from "@/components/PixKeyInput";
import { removePhotoFile, storeLogo, useFileUrl } from "@/modules/photos";
import { isSimpleMode, saveCompany, setEnabledServices, updateMaterial, updateService } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";
import { ReviewReminderForm } from "@/components/ReviewReminderForm";
import { reminderLabel } from "@/modules/reminder";
import { PushCard } from "@/components/PushCard";
import { PublicPageCard } from "@/components/PublicPageCard";
import { QuoteModeChoice } from "@/components/QuoteModeChoice";
import { APP_NAME } from "@/shared/brand";
import { AlarmClock, Calculator, Check, Download, FileText, ImagePlus, Package, PaintRoller, QrCode, CreditCard, Store, Users, Wrench } from "lucide-react";

function LogoPreview({ id }: { id: string }) {
  const url = useFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="Seu logo" className="h-20 w-20 rounded-2xl border border-line bg-white object-contain" /> : <div className="h-20 w-20 rounded-xl bg-[#F3F6FA]" />;
}

export default function Configuracoes() {
  const [leaving, setLeaving] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const db = useAppDb();
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoMsg, setLogoMsg] = useState("");
  const [pixTest, setPixTest] = useState(false);
  const auth = useAuthState();
  if (!db) return <Loading />;
  const c = db.company!;
  const simple = isSimpleMode(c);
  const set = (patch: Partial<typeof c>) => saveCompany({ ...c, ...patch });
  return (
    <Screen title="Ajustes" nav>
      <BrandHeader />
      <h2 className="mt-2 px-1 text-base font-semibold uppercase tracking-wide text-support">Meu negócio</h2>
      <SectionGroup>
      <Section title="Seu negócio" hint="Nome, WhatsApp e cidade" icon={Store}>
        <Field label="Nome"><TextInput value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="WhatsApp"><TextInput value={c.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="Cidade"><TextInput value={c.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Condição de pagamento padrão"><TextInput value={c.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
      </Section>
      <Section title="Seu orçamento em PDF" hint="Logo, cor e textos" icon={FileText}>
        <Field label="Seu nome (aparece no PDF)" hint="Opcional. Ex.: Carlos Silva"><TextInput value={c.ownerName ?? ""} onChange={(e) => set({ ownerName: e.target.value })} /></Field>
        <div className="flex flex-col gap-3">
          <p className="font-medium">Seu logo</p>
          <div className="flex items-center gap-4">
            {c.logoId ? <LogoPreview id={c.logoId} /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-brand text-base text-white">sem logo</div>}
            <div className="flex flex-1 flex-col gap-2">
              <Button variant="ghost" size="sm" icon={ImagePlus} onClick={() => logoInput.current?.click()}>{c.logoId ? "Trocar logo" : "Enviar meu logo"}</Button>
              {c.logoId ? <button className="min-h-12 font-display font-semibold text-err" onClick={() => { void removePhotoFile(c.logoId!); set({ logoId: undefined }); }}>Remover logo</button> : null}
            </div>
          </div>
          <input ref={logoInput} type="file" accept="image/*" hidden data-testid="logo-input" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setLogoMsg("");
            try { const old = c.logoId; const id = await storeLogo(f); set({ logoId: id }); if (old) void removePhotoFile(old); } catch { setLogoMsg("Não consegui ler essa imagem. Tente outra (PNG ou JPG)."); }
          }} />
          {logoMsg ? <p className="text-base text-err">{logoMsg}</p> : <p className="text-base text-support">Aparece no topo do PDF. Sem logo, usamos as iniciais do seu negócio.</p>}
        </div>
        <div>
          <p className="mb-2 font-medium">Sua cor (nome no app e no PDF)</p>
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
                {(c.brandColor ?? "#0F3B7A") === col.hex ? <Check size={24} strokeWidth={3} aria-hidden /> : null}
              </button>
            ))}
          </div>
        </div>
        <Field label="Entrada sugerida (%)" hint="Usada no botão de pagar do PDF, quando você coloca o link de pagamento."><NumberInput value={c.depositPct ?? 50} onChange={(n) => set({ depositPct: Math.min(100, Math.max(1, n || 50)) })} /></Field>
        <Field label="O que não está incluso" hint="Um item por linha."><TextArea value={c.exclusionsText ?? DEFAULT_PDF_TEXTS.exclusionsText} onChange={(e) => set({ exclusionsText: e.target.value })} /></Field>
        <Field label="Antes de começar (o que o cliente faz)" hint="Um item por linha."><TextArea value={c.beforeStartText ?? DEFAULT_PDF_TEXTS.beforeStartText} onChange={(e) => set({ beforeStartText: e.target.value })} /></Field>
        <Field label="Garantia"><TextArea value={c.warrantyText ?? DEFAULT_PDF_TEXTS.warrantyText} onChange={(e) => set({ warrantyText: e.target.value })} /></Field>
        <p className="text-base text-support">Esses textos são sugestões. Troque pelo que você realmente combina com seus clientes.</p>
      </Section>
      <Section title="Receber por Pix" hint={c.pix?.key ? "Chave cadastrada" : "Cadastre sua chave"} icon={QrCode} badge={c.pix?.key && normalizePixKey(c.pix.type, c.pix.key) ? { text: "Pronto", ok: true } : { text: "Falta" }}>
        <p className="text-base text-support">O dinheiro vai direto para a sua conta. O app só monta o código com a sua chave; ele não recebe nem guarda dinheiro.</p>
        <PixKeyInput
          initial={c.pix?.key ? { type: c.pix.type, key: c.pix.key } : undefined}
          onChange={(v) => set({ pix: { type: v?.type ?? c.pix?.type ?? "doc", key: v?.key ?? "", name: c.pix?.name, city: c.pix?.city } })}
        />
        <Field label="Nome que aparece para quem paga" hint="Até 25 letras. Se ficar vazio, usamos o nome do seu negócio.">
          <TextInput value={c.pix?.name ?? ""} maxLength={25} onChange={(e) => set({ pix: { type: c.pix?.type ?? "doc", key: c.pix?.key ?? "", name: e.target.value, city: c.pix?.city } })} />
        </Field>
        {c.pix?.key && normalizePixKey(c.pix.type, c.pix.key) ? (
          <>
            <Button variant="ghost" icon={QrCode} onClick={() => setPixTest(true)}>Ver o QR de teste (R$ 1,00)</Button>
            <p className="text-base text-support">Dica: pague esse R$ 1,00 para você mesmo, para ter certeza de que a chave está certa.</p>
          </>
        ) : null}
        {pixTest && c.pix ? (
          <PixModal code={pixPayload(c.pix, { name: c.name, city: c.city }, 100)} title="QR de teste" amount="R$ 1,00" onClose={() => setPixTest(false)} />
        ) : null}
      </Section>
      <Section title="Receber por cartão" hint={validPaymentLink(c.paymentLink ?? "") ? "Link cadastrado" : "Cadastre seu link de pagamento"} icon={CreditCard} badge={validPaymentLink(c.paymentLink ?? "") ? { text: "Pronto", ok: true } : undefined}>
        <p className="text-base text-support">O cliente paga o cartão no <b>seu</b> link de pagamento e o dinheiro cai direto na <b>sua</b> conta. O Medde não recebe nem guarda dinheiro, nem vê o cartão do cliente.</p>
        <Field label="Seu link de pagamento" hint="Começa com https://. Ele aparece como “Pagar com cartão” depois que o cliente toca em Fechar agora.">
          <TextInput type="url" inputMode="url" placeholder="https://" value={c.paymentLink ?? ""} onChange={(e) => set({ paymentLink: e.target.value.trim() || undefined })} />
        </Field>
        {c.paymentLink && !validPaymentLink(c.paymentLink) ? <p role="alert" className="text-base text-err">O link precisa começar com https://</p> : null}
        {validPaymentLink(c.paymentLink ?? "") ? <a className="inline-flex min-h-12 items-center font-display font-semibold text-live underline" href={c.paymentLink} target="_blank" rel="noopener noreferrer">Abrir meu link para conferir</a> : null}
        <details className="rounded-2xl bg-[#F3F6FA] p-3 text-base">
          <summary className="flex min-h-12 cursor-pointer items-center font-display font-semibold">Como criar meu link de pagamento</summary>
          <ol className="mt-2 list-decimal pl-5 leading-6">
            <li>Abra o app do seu banco ou de um serviço como Mercado Pago, InfinitePay ou PagBank.</li>
            <li>Procure por <b>“link de pagamento”</b> ou <b>“cobrar por link”</b>.</li>
            <li>Crie um link, de preferência sem valor fixo (ou com o valor da entrada).</li>
            <li>Copie o endereço e cole aqui.</li>
          </ol>
          <p className="mt-2 text-support">Taxas, parcelamento e prazo para receber são definidos por esse serviço. Confira as condições dele antes de usar. Os nomes dos menus mudam de app para app.</p>
        </details>
      </Section>
      </SectionGroup>
      <h2 className="mt-2 px-1 text-base font-semibold uppercase tracking-wide text-support">Clientes e avisos</h2>
      <SectionGroup>
      <SectionLink href="/clientes" title="Meus clientes" hint="Lista, telefone e endereço" icon={Users} />
      {cloudEnabled && auth.status === "ready" ? <PublicPageCard db={db} /> : null}
      {cloudEnabled && auth.status === "ready" ? <PushCard /> : null}
      <Section title="Lembrete de revisão" hint={c.reviewReminder ? reminderLabel(c.reviewReminder) : "Aviso diário"} icon={AlarmClock} badge={c.reviewReminder ? { text: "Ativo", ok: true } : undefined}>
        <ReviewReminderForm saved={c.reviewReminder} onSave={(rr) => saveCompany({ ...c, reviewReminder: rr })} />
      </Section>
      </SectionGroup>
      <h2 className="mt-2 px-1 text-base font-semibold uppercase tracking-wide text-support">Meus orçamentos</h2>
      <SectionGroup>
      <Section title="Como você faz orçamento?" hint={simple ? "Só voz e preço fechado" : "Com cálculo: medidas e lucro"} icon={Calculator}>
        <QuoteModeChoice value={c.quoteMode ?? "calc"} onChange={(m) => set({ quoteMode: m })} hideTitle />
      </Section>
      {simple ? null : <>
      <Section title="Serviços e preços" hint="Quanto você cobra" icon={PaintRoller}>
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
              {on && s.isDemo ? <span className="text-base text-[#8A4B00]">Valor de exemplo — confira</span> : null}
            </div>
          );
        })}
      </Section>
      <Section title="Materiais" hint="Preço e rendimento" icon={Package}>
        {db.materials.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 border-b border-slate-100 pb-3">
            <div className="font-medium">{m.name} ({m.unit}){m.isDemo ? <span className="ml-2 text-base text-[#8A4B00]">exemplo</span> : null}</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Preço R$"><NumberInput value={m.priceCents / 100} onChange={(n) => updateMaterial(m.id, { priceCents: toCents(n) })} /></Field>
              <Field label="Rende" help="Quantos m² (ou metros ou unidades) 1 unidade do material cobre. Ex.: se 1 lata cobre 100 m², escreva 100."><NumberInput value={m.yieldPerUnit} onChange={(n) => updateMaterial(m.id, { yieldPerUnit: n > 0 ? n : 1 })} /></Field>
              <Field label="Perda de material (%)" help="Quanto do material se perde em respingos e sobras. Ex.: 10 significa 10% a mais de material."><NumberInput value={m.wastePct} onChange={(n) => updateMaterial(m.id, { wastePct: n })} /></Field>
            </div>
          </div>
        ))}
        <p className="text-base text-support">&quot;Rende&quot; = quantos m² (ou metros/unidades) 1 unidade do material cobre.</p>
      </Section>
      <Section title="Avançado: custos e lucro" hint="Diária e margem" icon={Wrench}>
        <Field label="Diária que você quer ganhar (R$)"><NumberInput value={c.dailyRateCents / 100} onChange={(n) => set({ dailyRateCents: toCents(n) })} /></Field>
        <Field label="Horas de trabalho por dia"><NumberInput value={c.hoursPerDay} onChange={(n) => set({ hoursPerDay: n || 8 })} /></Field>
        <Field label="Dias de segurança no prazo"><NumberInput value={c.safetyDays} onChange={(n) => set({ safetyDays: n })} /></Field>
        <Field label="Quanto quero que sobre (%)" help="Parte do preço final que deve sobrar de lucro. Ex.: 30 significa que de cada R$ 100 cobrados, R$ 30 sobram."><NumberInput value={c.marginPct} onChange={(n) => set({ marginPct: Math.min(n, 95) })} /></Field>
        <div>
          <p className="mb-2 font-medium">Como calcular o preço?</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={c.pricingMode === "base_price"} onClick={() => set({ pricingMode: "base_price" })}>Pelo meu preço por serviço</Chip>
            <Chip active={c.pricingMode === "cost_plus"} onClick={() => set({ pricingMode: "cost_plus" })}>Custo + lucro</Chip>
          </div>
        </div>
        {c.pricingMode === "cost_plus" ? (
          <div className="flex flex-wrap gap-2">
            <Chip active={c.marginMode === "on_price"} onClick={() => set({ marginMode: "on_price" })}>% do preço que sobra</Chip>
            <Chip active={c.marginMode === "markup"} onClick={() => set({ marginMode: "markup" })}>% somada ao custo</Chip>
          </div>
        ) : null}
        {c.pricingMode === "cost_plus" ? (
          <p className="text-base leading-[22px] text-support">Ex.: custo de R$ 70 e 30%. <b>% do preço que sobra:</b> o preço sai R$ 100 e sobram R$ 30. <b>% somada ao custo:</b> o preço sai R$ 91 (70 + 30% de 70).</p>
        ) : null}
      </Section>
      </>}
      </SectionGroup>
      <h2 className="mt-2 px-1 text-base font-semibold uppercase tracking-wide text-support">Conta e ajuda</h2>
      <InstallBanner always />
      {cloudEnabled && auth.status === "ready" ? <SubscriptionCard /> : null}
      {cloudEnabled && auth.status === "ready" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-medium">Conta</h2>
          <p className="text-support">{auth.email}</p>
          <Button variant="ghost" disabled={leaving} onClick={async () => { setLeaving(true); if ((await prepareLogout()) === "unsent") { setLeaving(false); setAskLeave(true); } else await signOutAndWipe(); }}>{leaving ? "Saindo…" : "Sair"}</Button>
          <p className="text-base text-support">Ao sair, apagamos os dados e as fotos deste aparelho. Eles continuam guardados na sua conta.</p>
          <ConfirmDialog
            open={askLeave}
            title="Há dados que ainda não foram enviados"
            text="Sem internet, algumas alterações ainda não chegaram à sua conta. Se sair agora, elas serão apagadas deste aparelho e perdidas. Conecte-se à internet e tente de novo para não perder nada."
            confirmLabel="Sair e perder"
            onCancel={() => setAskLeave(false)}
            onConfirm={async () => { setAskLeave(false); setLeaving(true); await signOutAndWipe(); }}
          />
          <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadMyData()}>Baixar meus dados</Button>
          <DeleteAccountCard />
        </Card>
      ) : null}
      <div className="flex items-center justify-center gap-2 pt-2 text-base text-support">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/simbolo-colorido.svg" alt="" className="h-5 w-5" />
        {APP_NAME} · versão 1.0
      </div>
    </Screen>
  );
}
