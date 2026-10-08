"use client";
import Link from "next/link";
import { Check, ChevronDown, Circle, EyeOff } from "lucide-react";
import { Button } from "./ui";
import { saveCompany } from "@/modules/settings";
import { firstSteps } from "@/modules/firstSteps";
import type { Db } from "@/modules/types";

/** Primeiros passos na tela de Visitas: uma linha recolhida (toque para abrir). Some sozinha quando tudo está feito, ou se o pintor dispensar. */
export function FirstSteps({ db }: { db: Db }) {
  const c = db.company;
  if (!c || c.stepsHidden) return null;
  const steps = firstSteps(db);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <div data-testid="primeiros-passos">
      <details className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2"><b className="font-display text-lg">Primeiros passos</b><span className="text-base text-support">{done} de {steps.length}</span></span>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
              <span className="block h-full rounded-full bg-accent-dark" style={{ width: `${(done / steps.length) * 100}%` }} />
            </span>
          </span>
          <ChevronDown size={24} strokeWidth={2.2} aria-hidden className="shrink-0 text-support transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-1 px-4 pb-3">
          <ul className="flex flex-col">
            {steps.map((s) => (
              <li key={s.id}>
                {s.done ? (
                  <div className="flex min-h-12 items-center gap-3 text-support"><Check size={22} strokeWidth={2.6} aria-hidden className="text-accent-dark" /><span className="line-through">{s.label}</span></div>
                ) : (
                  <Link href={s.href} className="flex min-h-12 items-center gap-3 font-semibold text-ink"><Circle size={22} strokeWidth={2} aria-hidden className="text-support" />{s.label}</Link>
                )}
              </li>
            ))}
          </ul>
          <Button variant="danger" size="sm" icon={EyeOff} onClick={() => saveCompany({ ...c, stepsHidden: true })}>Não mostrar mais</Button>
        </div>
      </details>
    </div>
  );
}
