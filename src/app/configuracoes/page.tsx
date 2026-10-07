"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { InstallBanner } from "@/components/InstallBanner";
import { AutoTour, type TourStep } from "@/components/Tour";
import { LinkButton, Button, Card, ConfirmDialog, Section, Chip, Field, Loading, NumberInput, Screen, TextArea, TextInput } from "@/components/ui";
import { DEFAULT_PDF_TEXTS, PDF_COLORS } from "@/modules/catalog";
import { cloudEnabled, useAuthState } from "@/modules/auth";
import { downloadMyData, prepareLogout, signOutAndWipe } from "@/modules/account";
import { BrandHeader } from "@/components/BrandHeader";
import { PixModal } from "@/components/PixModal";
import { normalizePixKey, PIX_TYPE_LABEL, pixPayload, type PixKeyType } from "@/modules/pix";
import { removePhotoFile, storeLogo, useFileUrl } from "@/modules/photos";
import { isSimpleMode, resetTours, saveCompany, setEnabledServices, updateMaterial, updateService } from "@/modules/settings";
import { useAppDb } from "@/modules/useApp";
import { toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";
import { ReviewReminderForm } from "@/components/ReviewReminderForm";
import { reminderLabel } from "@/modules/reminder";
import { PublicPageCard } from "@/components/PublicPageCard";
import { QuoteModeChoice } from "@/components/QuoteModeChoice";
import { APP_NAME } from "@/shared/brand";
import { Check, QrCode, Users } from "lucide-react";

function LogoPreview({ id }: { id: string }) {
  const url = useFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="Seu logo" className="h-20 w-20 rounded-xl border border-slate-200 bg-white object-contain" /> : <div className="h-20 w-20 rounded-xl bg-slate-100" />;
}

export default function Configuracoes() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const db = useAppDb();
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoMsg, setLogoMsg] = useState("");
  const [pixTest, setPixTest] = useState(false);
  const auth = useAuthState();
  if (!db) return <Loading />;
  const steps: TourStep[] = ([
    { target: "aj-negocio", title: "Seu negócio", text: "Nome, WhatsApp e cidade. O nome e o WhatsApp aparecem no orçamento que o cliente recebe." },
    { target: "aj-pdf", title: "Seu orçamento em PDF", text: "Coloque seu logo, escolha a cor e ajuste a entrada e os textos de garantia. É a cara do seu orçamento." },
    { target: "aj-pix", title: "Receber por Pix", text: "Cadastre sua chave Pix e o orçamento sai com o QR para o cliente pagar a entrada." },
    { target: "aj-servicos", title: "Serviços e preços", text: "Quanto você cobra por serviço. Os que dizem valor de exemplo precisam da sua confirmação para o orçamento ficar certo." },
    { target: "aj-guias", title: "Rever os guias", text: "Se quiser ver este passo a passo de novo, é só voltar aqui e tocar em Ver os guias de novo." },
  ] as TourStep[]).filter((st) => !(isSimpleMode(db.company) && st.target === "aj-servicos"));
  const c = db.company!;
  const simple = isSimpleMode(c);
  const set = (patch: Partial<typeof c>) => saveCompany({ ...c, ...patch });
  return (
    <Screen title="Ajustes" nav>
      <BrandHeader />
      <LinkButton href="/clientes" variant="ghost" icon={Users}>Meus clientes</LinkButton>
      <h2 className="mt-2 px-1 text-base font-bold uppercase tracking-wide text-support">Meu negócio</h2>
      <div data-tour="aj-negocio">
      <Section title="Seu negócio" hint="Nome, WhatsApp, cidade e pagamento" open>
        <Field label="Nome"><TextInput value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="WhatsApp"><TextInput value={c.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="Cidade"><TextInput value={c.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Condição de pagamento padrão"><TextInput value={c.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
      </Section>
      </div>
      <div data-tour="aj-pdf">
      <Section title="Seu orçamento em PDF" hint="Logo, sua cor, entrada e textos do PDF">
        <Field label="Seu nome (aparece no PDF)" hint="Opcional. Ex.: Carlos Silva"><TextInput value={c.ownerName ?? ""} onChange={(e) => set({ ownerName: e.target.value })} /></Field>
        <div className="flex flex-col gap-3">
          <p className="font-medium">Seu logo</p>
          <div className="flex items-center gap-4">
            {c.logoId ? <LogoPreview id={c.logoId} /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-brand text-base text-white">sem logo</div>}
            <div className="flex flex-1 flex-col gap-2">
              <Button variant="ghost" onClick={() => logoInput.current?.click()}>{c.logoId ? "Trocar logo" : "Enviar meu logo"}</Button>
              {c.logoId ? <button className="min-h-10 text-err underline" onClick={() => { void removePhotoFile(c.logoId!); set({ logoId: undefined }); }}>Remover logo</button> : null}
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
      </div>
      <div data-tour="aj-pix">
      <Section title="Receber por Pix" hint="Gera o Pix copia e cola e o QR nos orçamentos e nas obras">
        <p className="text-base text-support">O dinheiro vai direto para a sua conta. O app só monta o código com a sua chave; ele não recebe nem guarda dinheiro.</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PIX_TYPE_LABEL) as PixKeyType[]).map((t) => (
            <Chip key={t} active={(c.pix?.type ?? "doc") === t} onClick={() => set({ pix: { type: t, key: "", name: c.pix?.name, city: c.pix?.city } })}>{PIX_TYPE_LABEL[t]}</Chip>
          ))}
        </div>
        <Field label={`Sua chave Pix (${PIX_TYPE_LABEL[c.pix?.type ?? "doc"].toLowerCase()})`}>
          <TextInput value={c.pix?.key ?? ""} inputMode={(c.pix?.type ?? "doc") === "email" ? "email" : "text"} onChange={(e) => set({ pix: { type: c.pix?.type ?? "doc", key: e.target.value, name: c.pix?.name, city: c.pix?.city } })} />
        </Field>
        {c.pix?.key ? (
          normalizePixKey(c.pix.type, c.pix.key) ? <p className="inline-flex items-center gap-1.5 text-base font-bold text-accent-dark"><Check size={20} strokeWidth={2.6} aria-hidden />Chave válida</p> : <p className="text-base text-err">Essa chave não parece certa para o tipo escolhido.</p>
        ) : null}
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
      </div>
      {cloudEnabled && auth.status === "ready" ? <PublicPageCard db={db} /> : null}
      <Section title="Lembrete de revisão" hint={c.reviewReminder ? `Ativo: ${reminderLabel(c.reviewReminder)}` : "Um aviso diário para ver quem não respondeu"}>
        <ReviewReminderForm saved={c.reviewReminder} onSave={(rr) => saveCompany({ ...c, reviewReminder: rr })} />
      </Section>
      <h2 className="mt-2 px-1 text-base font-bold uppercase tracking-wide text-support">Meus orçamentos</h2>
      <Section title="Como você faz orçamento?" hint={simple ? "Agora: só voz e preço fechado" : "Agora: com cálculo (medidas, preços e lucro)"}>
        <QuoteModeChoice value={c.quoteMode ?? "calc"} onChange={(m) => set({ quoteMode: m })} hideTitle />
      </Section>
      {simple ? null : <>
      <div data-tour="aj-servicos">
      <Section title="Serviços e preços" hint="Quanto você cobra por serviço">
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
      </div>
      <Section title="Materiais" hint="Preço, rendimento e perda">
        {db.materials.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 border-b border-slate-100 pb-3">
            <div className="font-medium">{m.name} ({m.unit}){m.isDemo ? <span className="ml-2 text-base text-[#8A4B00]">exemplo</span> : null}</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Preço R$"><NumberInput value={m.priceCents / 100} onChange={(n) => updateMaterial(m.id, { priceCents: toCents(n) })} /></Field>
              <Field label="Rende"><NumberInput value={m.yieldPerUnit} onChange={(n) => updateMaterial(m.id, { yieldPerUnit: n > 0 ? n : 1 })} /></Field>
              <Field label="Perda %"><NumberInput value={m.wastePct} onChange={(n) => updateMaterial(m.id, { wastePct: n })} /></Field>
            </div>
          </div>
        ))}
        <p className="text-base text-support">&quot;Rende&quot; = quantos m² (ou metros/unidades) 1 unidade do material cobre.</p>
      </Section>
      <Section title="Avançado: custos e lucro" hint="Diária, margem e jeito de calcular o preço">
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
      </Section>
      </>}
      <h2 className="mt-2 px-1 text-base font-bold uppercase tracking-wide text-support">Conta e ajuda</h2>
      <div data-tour="aj-guias">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Guias</h2>
        <p className="text-base text-support">Quer rever o passo a passo de Visitas, Orçamentos, Obras e Ajustes?</p>
        <Button variant="ghost" onClick={() => { resetTours(); router.push("/visitas"); }}>Ver os guias de novo</Button>
      </Card>
      </div>
      <InstallBanner always />
      {cloudEnabled && auth.status === "ready" ? <SubscriptionCard /> : null}
      {cloudEnabled && auth.status === "ready" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Conta</h2>
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
          <Button variant="ghost" onClick={() => downloadMyData()}>Baixar meus dados</Button>
          <DeleteAccountCard />
        </Card>
      ) : null}
      <div className="flex items-center justify-center gap-2 pt-2 text-base text-support">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/simbolo-colorido.svg" alt="" className="h-5 w-5" />
        {APP_NAME} · versão 1.0
      </div>
      <AutoTour id="ajustes" steps={steps} />
    </Screen>
  );
}
