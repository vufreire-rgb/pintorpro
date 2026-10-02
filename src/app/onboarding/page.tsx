"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Chip, Field, Loading, NumberInput, TextInput } from "@/components/ui";
import { useDb } from "@/modules/db";
import { DEFAULT_COMPANY, saveCompany, setEnabledServices, updateService } from "@/modules/settings";
import type { Company } from "@/modules/types";
import { formatBRL, toCents } from "@/shared/money";
import { UNIT_LABEL } from "@/shared/format";

const STEPS = 10;

export default function Onboarding() {
  const db = useDb();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Company>(DEFAULT_COMPANY);
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  // Se os dados da conta chegarem da nuvem enquanto o cadastro está aberto, a conta já está configurada.
  const alreadySetUp = Boolean(db?.company);
  useEffect(() => {
    if (alreadySetUp) router.replace("/");
  }, [alreadySetUp, router]);
  if (!db || alreadySetUp) return <Loading />;
  const services = db.services;
  const on = enabled ?? services.map((s) => s.id);
  const set = <K extends keyof Company>(k: K, v: Company[K]) => setC((p) => ({ ...p, [k]: v }));

  const finish = () => {
    setEnabledServices(on);
    for (const [id, reais] of Object.entries(prices)) updateService(id, { salePriceCents: toCents(reais) });
    saveCompany(c);
    router.replace("/");
  };

  const canNext = [c.name.trim(), c.whatsapp.trim(), c.city.trim(), on.length > 0, true, c.dailyRateCents > 0, c.hoursPerDay > 0, c.marginPct >= 0, c.paymentTerms.trim(), true][step];
  const next = () => (step === STEPS - 1 ? finish() : setStep(step + 1));

  const body = [
    <Field key="n" label="Como você chama seu negócio?" hint="Aparece no orçamento do cliente."><TextInput autoFocus value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: João Pinturas" /></Field>,
    <Field key="w" label="Qual seu WhatsApp?"><TextInput type="tel" inputMode="tel" autoFocus value={c.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" /></Field>,
    <Field key="c" label="Em qual cidade você trabalha?"><TextInput autoFocus value={c.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Campinas - SP" /></Field>,
    <div key="s" className="flex flex-col gap-3">
      <p className="text-lg font-medium">Quais serviços você faz?</p>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <Chip key={s.id} active={on.includes(s.id)} onClick={() => setEnabled(on.includes(s.id) ? on.filter((x) => x !== s.id) : [...on, s.id])}>{s.name}</Chip>
        ))}
      </div>
    </div>,
    <div key="p" className="flex flex-col gap-3">
      <p className="text-lg font-medium">Quanto você cobra por serviço?</p>
      <p className="text-sm text-slate-500">Valores de exemplo já preenchidos — ajuste os seus. Você pode mudar depois.</p>
      {services.filter((s) => on.includes(s.id)).map((s) => (
        <Field key={s.id} label={`${s.name} (R$ por ${UNIT_LABEL[s.unit]})`}>
          <NumberInput value={prices[s.id] ?? s.salePriceCents / 100} onChange={(n) => setPrices((p) => ({ ...p, [s.id]: n }))} />
        </Field>
      ))}
    </div>,
    <Field key="d" label="Quanto você quer ganhar por dia de trabalho? (R$)" hint="Usamos isso para calcular o custo da mão de obra."><NumberInput autoFocus value={c.dailyRateCents / 100} onChange={(n) => set("dailyRateCents", toCents(n))} /></Field>,
    <Field key="h" label="Quantas horas você trabalha por dia?"><NumberInput autoFocus value={c.hoursPerDay} onChange={(n) => set("hoursPerDay", n)} /></Field>,
    <Field key="m" label="Que margem de lucro você quer? (%)" hint="Ex.: 30 significa 30% do preço final é lucro."><NumberInput autoFocus value={c.marginPct} onChange={(n) => set("marginPct", n)} /></Field>,
    <Field key="pg" label="Como você costuma receber?" hint="Aparece no orçamento. Pode mudar em cada orçamento."><TextInput autoFocus value={c.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>,
    <div key="ok" className="flex flex-col gap-3 text-lg">
      <p className="text-2xl font-bold">Tudo pronto! 🎉</p>
      <p>Sua conta está configurada. Diária: {formatBRL(c.dailyRateCents)}.</p>
      <p className="text-sm text-slate-500">Os preços e o consumo dos materiais estão com valores de exemplo. Confira em <b>Ajustes</b> quando puder.</p>
    </div>,
  ][step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <div className="mb-6 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / STEPS) * 100}%` }} /></div>
      <div className="flex flex-1 flex-col justify-center gap-4">{body}</div>
      <div className="flex gap-3 pt-6">
        {step > 0 ? <Button variant="ghost" className="w-28" onClick={() => setStep(step - 1)}>Voltar</Button> : null}
        <Button disabled={!canNext} onClick={next}>{step === STEPS - 1 ? "Ir para o painel" : "Continuar"}</Button>
      </div>
    </div>
  );
}
