"use client";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Button, Card } from "./ui";
import { saveCompany } from "@/modules/settings";
import { firstSteps } from "@/modules/firstSteps";
import type { Db } from "@/modules/types";

/** Lista de primeiros passos na tela de Visitas. Some sozinha quando tudo está feito, ou se o pintor dispensar. */
export function FirstSteps({ db }: { db: Db }) {
  const c = db.company;
  if (!c || c.stepsHidden) return null;
  const steps = firstSteps(db);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <div data-testid="primeiros-passos"><Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <b className="font-display text-lg">Primeiros passos</b>
        <span className="text-base text-support">{done} de {steps.length}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-accent-dark" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
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
      <Button variant="danger" onClick={() => saveCompany({ ...c, stepsHidden: true })}>Não mostrar mais</Button>
    </Card></div>
  );
}
