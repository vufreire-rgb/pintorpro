"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Aviso quando o orçamento vira Fechado: o único momento (fora a abertura e o login) em que o símbolo do app aparece. */
export function FechouNotice({ owner, number, onClose }: { owner?: string; number: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);
  const first = (owner ?? "").trim().split(/\s+/)[0];
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md flex-col gap-3 rounded-[20px] border border-line bg-white p-[18px] shadow-xl" role="status">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/simbolo-colorido.svg" alt="" className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <div className="font-display text-[28px] font-extrabold leading-[34px]">Fechou!</div>
          <div className="text-base text-support">Bom trabalho{first ? `, ${first}` : ""}. O orçamento {number} foi fechado.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/obras" className="inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-brand bg-white font-display text-lg font-bold text-brand">Ver a obra</Link>
        <button className="min-h-12 rounded-2xl font-display text-lg font-bold text-support" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
