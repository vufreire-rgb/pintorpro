"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Loading, Ruler, TextInput } from "@/components/ui";
import { useDb } from "@/modules/db";
import { DEFAULT_COMPANY, saveCompany, setEnabledServices } from "@/modules/settings";
import { QuoteModeChoice } from "@/components/QuoteModeChoice";
import type { Company } from "@/modules/types";

const STEPS = 2;
const STEP_NAMES = ["Negócio", "WhatsApp"];

export default function Onboarding() {
  const db = useDb();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Company>(DEFAULT_COMPANY);
  // Se os dados da conta chegarem da nuvem enquanto o cadastro está aberto, a conta já está configurada.
  const alreadySetUp = Boolean(db?.company);
  const [finishing, setFinishing] = useState(false); // evita o redirecionamento automático para Visitas competir com o que o cadastro faz ao terminar
  useEffect(() => {
    if (alreadySetUp && !finishing) router.replace("/visitas");
  }, [alreadySetUp, finishing, router]);
  if (!db || (alreadySetUp && !finishing)) return <Loading />;
  const set = <K extends keyof Company>(k: K, v: Company[K]) => setC((p) => ({ ...p, [k]: v }));

  const finish = () => {
    setFinishing(true);
    setEnabledServices(db.services.map((s) => s.id));
    saveCompany(c);
    router.replace("/visitas");
  };

  const canNext = [c.name.trim(), c.whatsapp.trim()][step];
  const next = () => (step === STEPS - 1 ? finish() : setStep(step + 1));

  const body = [
    <Field key="n" label="Como você chama seu negócio?" hint="Aparece no orçamento do cliente."><TextInput autoFocus value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: João Pinturas" /></Field>,
    <div key="w" className="flex flex-col gap-6">
      <Field label="Qual seu WhatsApp?"><TextInput type="tel" inputMode="tel" autoFocus value={c.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" /></Field>
      <QuoteModeChoice value={c.quoteMode ?? "calc"} onChange={(m) => set("quoteMode", m)} />
    </div>,
  ][step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <div className="mb-6"><Ruler total={STEPS} current={step} label={STEP_NAMES[step]} /></div>
      <div className="flex flex-1 flex-col justify-center gap-4">{body}</div>
      <div className="flex gap-3 pt-6">
        {step > 0 ? <Button variant="ghost" className="w-28" onClick={() => setStep(step - 1)}>Voltar</Button> : null}
        <Button disabled={!canNext} onClick={next}>{step === STEPS - 1 ? "Começar" : "Continuar"}</Button>
      </div>
    </div>
  );
}
