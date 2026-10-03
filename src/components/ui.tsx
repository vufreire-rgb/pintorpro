"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtNum, parseNum } from "@/shared/format";

export function Screen({ title, back, children, nav = false }: { title: string; back?: string; children: React.ReactNode; nav?: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {back ? (
          <Link href={back} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-xl" aria-label="Voltar">
            ←
          </Link>
        ) : null}
        <h1 className="text-xl font-bold">{title}</h1>
      </header>
      <main className={`flex flex-1 flex-col gap-4 p-4 ${nav ? "pb-28" : "pb-8"}`}>{children}</main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}

const NAV = [
  ["/visitas", "Visitas"],
  ["/orcamentos", "Orçamentos"],
  ["/obras", "Obras"],
  ["/configuracoes", "Ajustes"],
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {NAV.map(([href, label]) => (
        <Link key={href} href={href} className="flex-1 py-4 text-center text-sm font-medium text-slate-700 active:bg-slate-100">
          {label}
        </Link>
      ))}
    </nav>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "success" };
const VARIANT = {
  primary: "bg-brand text-white active:bg-brand-dark",
  success: "bg-accent-dark text-white active:bg-accent-dark/90",
  danger: "bg-red-600 text-white active:bg-red-700",
  ghost: "bg-slate-100 text-slate-900 active:bg-slate-200",
};
export function Button({ variant = "primary", className = "", ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={`min-h-14 w-full rounded-2xl px-5 text-lg font-semibold disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: React.ReactNode; variant?: keyof typeof VARIANT; className?: string }) {
  return (
    <Link href={href} className={`grid min-h-14 w-full place-items-center rounded-2xl px-5 text-lg font-semibold ${VARIANT[variant]} ${className}`}>
      {children}
    </Link>
  );
}

/** Cartão. Cor de fundo e de borda podem ser trocadas pelo `className` (ex.: "bg-brand-soft border-brand/30"). */
export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border p-4 ${/\bbg-/.test(className) ? "" : "bg-white"} ${/(^|\s)border-(brand|accent|slate|amber|red|blue|emerald|green|white|black)/.test(className) ? "" : "border-slate-200"} ${className}`}>{children}</section>
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-medium">{label}</span>
      {children}
      {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg outline-brand";

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={inputCls} />;
}

export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${inputCls} min-h-40 py-3`} />;
}

/** Campo numérico que aceita vírgula (2,5). */
export function NumberInput({ value, onChange, ...rest }: { value: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value ? fmtNum(value, 4) : "");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parseNum(text) !== value) setText(value ? fmtNum(value, 4) : "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...rest}
      inputMode="decimal"
      className={inputCls}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
    />
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-full border px-4 text-base ${active ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-900"}`}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="h-12 w-12 rounded-full bg-slate-100 text-2xl" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="w-8 text-center text-xl font-semibold">{value}</span>
      <button type="button" className="h-12 w-12 rounded-full bg-slate-100 text-2xl" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export const Loading = () => <div className="grid min-h-dvh place-items-center text-slate-500">Carregando…</div>;

/** Janela de confirmação para ações que não têm volta (apagar). */
export function ConfirmDialog({ open, title, text, confirmLabel = "Sim, apagar", onConfirm, onCancel }: {
  open: boolean; title: string; text: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-3xl bg-white p-5">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-slate-700">{text}</p>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
