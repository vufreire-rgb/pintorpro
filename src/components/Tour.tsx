"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui";

export interface TourStep {
  /** Valor do atributo `data-tour` do elemento destacado. */
  target: string;
  title: string;
  text: string;
  /** Quando vira `true` (a pessoa fez o que o passo pede), o guia avança sozinho. */
  done?: boolean;
}

interface Box { top: number; left: number; width: number; height: number }

/**
 * Guia passo a passo: escurece a tela, destaca um bloco e explica em uma caixa curta.
 * A tela continua usável (o destaque não bloqueia toques), então a pessoa pode fazer o passo de verdade.
 */
export function Tour({ steps, onFinish, onSkip }: { steps: TourStep[]; onFinish: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  useEffect(() => {
    const el = () => document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const target = el();
    if (target) {
      target.style.scrollMarginTop = "88px"; // deixa o bloco no alto da tela; a caixa do guia fica embaixo
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    const measure = () => {
      const r = el()?.getBoundingClientRect();
      setBox(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };
    measure();
    const t = window.setInterval(measure, 150); // acompanha a rolagem e mudanças de tamanho
    return () => window.clearInterval(t);
  }, [step.target]);

  const done = step.done;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (done && !last) setI((n) => n + 1);
  }, [done, last]);

  return (
    <>
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-[22px] ring-4 ring-accent transition-all"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12, boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)" }}
        />
      ) : null}
      <div role="dialog" aria-label="Guia" className={`fixed inset-x-3 z-50 mx-auto flex max-w-md flex-col gap-2 rounded-[20px] border-2 border-brand bg-white p-4 shadow-xl bottom-3`}>
        <p className="text-base text-support">Passo {i + 1} de {steps.length}</p>
        <b className="font-display text-lg leading-6">{step.title}</b>
        <p className="text-base">{step.text}</p>
        <div className="mt-1 flex gap-2">
          {!last ? <Button variant="ghost" className="!w-auto shrink-0 !px-4" onClick={onSkip}>Pular</Button> : null}
          <Button onClick={() => (last ? onFinish() : setI(i + 1))}>{last ? "Concluir" : "Próximo"}</Button>
        </div>
      </div>
    </>
  );
}
