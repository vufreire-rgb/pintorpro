"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, FileText, MapPin, Minus, PaintRoller, Plus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { fmtNum, parseNum } from "@/shared/format";

export function Screen({ title, back, children, nav = false }: { title: string; back?: string; children: React.ReactNode; nav?: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {back ? (
          <Link href={back} className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-ink" aria-label="Voltar">
            <ArrowLeft size={24} strokeWidth={2.2} aria-hidden />
          </Link>
        ) : null}
        <h1 className="text-[28px] font-bold leading-[34px]">{title}</h1>
      </header>
      <main className={`flex flex-1 flex-col gap-4 p-4 ${nav ? "pb-28" : "pb-8"}`}>{children}</main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}

const NAV = [
  ["/visitas", "Visitas", MapPin],
  ["/orcamentos", "Orçamentos", FileText],
  ["/obras", "Obras", PaintRoller],
  ["/configuracoes", "Ajustes", SlidersHorizontal],
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-20 max-w-md grid-cols-4 items-center border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)]">
      {NAV.map(([href, label, Icon]) => {
        const here = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={here ? "page" : undefined} className={`flex flex-col items-center gap-1 text-[14px] leading-4 ${here ? "font-bold text-brand" : "text-support"}`}>
            <span className={`flex h-8 w-14 items-center justify-center rounded-2xl ${here ? "bg-brand-soft" : ""}`}>
              <Icon size={24} strokeWidth={2.2} aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

type Variant = "primary" | "ghost" | "danger" | "success" | "danger-solid";
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon };
/** primary/success = a ação principal da tela (verde, só uma por tela). ghost = secundário. danger = só texto vermelho ("Apagar"). */
const VARIANT: Record<Variant, string> = {
  primary: "min-h-16 bg-accent-dark text-xl font-bold uppercase tracking-[0.02em] text-white active:bg-accent-dark/90",
  success: "min-h-16 bg-accent-dark text-xl font-bold uppercase tracking-[0.02em] text-white active:bg-accent-dark/90",
  ghost: "min-h-14 border-2 border-brand bg-white text-xl font-bold text-brand active:bg-brand-soft disabled:text-support",
  danger: "min-h-12 bg-transparent text-lg font-bold text-err active:bg-red-50",
  "danger-solid": "min-h-14 bg-err text-xl font-bold text-white active:opacity-90",
};
const BASE = "inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 font-display disabled:opacity-50";

/** Classe de botão para links <a> externos. */
export const buttonCls = (variant: Variant = "ghost", extra = ""): string => `${BASE} ${VARIANT[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", icon: Icon, children, ...p }: BtnProps) {
  return (
    <button {...p} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {Icon ? <Icon size={24} strokeWidth={2.2} aria-hidden className="shrink-0" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className = "", icon: Icon }: { href: string; children: React.ReactNode; variant?: Variant; className?: string; icon?: LucideIcon }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {Icon ? <Icon size={24} strokeWidth={2.2} aria-hidden className="shrink-0" /> : null}
      {children}
    </Link>
  );
}

type Tone = "open" | "ok" | "lost" | "warn";
const TONE: Record<Tone, string> = {
  open: "bg-[#E8EFFA] text-[#0F3B7A]",
  ok: "bg-[#E3F4EA] text-[#07602F]",
  lost: "bg-[#ECEFF3] text-[#4F5F73]",
  warn: "bg-[#FFF3D6] text-[#8A4B00]",
};
/** Etiqueta de situação: Aberto (azul), Fechado (verde), Perdido (cinza), Atenção (âmbar). Vermelho fica só para erro. */
export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-3 py-0.5 text-base font-bold ${TONE[tone]}`}>{children}</span>;
}

/** Título de cartão com ícone de traço (sem emoji). */
export function CardTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-[22px] font-bold leading-7">
      {Icon ? <Icon size={24} strokeWidth={2.2} aria-hidden className="shrink-0 text-brand" /> : null}
      {children}
    </h2>
  );
}

/** Botão pequeno de ação dentro de um cartão (secundário, com ícone). */
export const ACTION_CLS = "inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-brand bg-white px-2 font-display text-base font-bold text-brand active:bg-brand-soft disabled:opacity-50";

/** Bloco que abre e fecha (para telas longas, como Ajustes). */
export function Section({ title, hint, open = false, children }: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-slate-200 bg-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
        <span>
          <span className="block font-display text-[22px] font-bold leading-7">{title}</span>
          {hint ? <span className="block text-base text-support">{hint}</span> : null}
        </span>
        <ChevronDown size={24} strokeWidth={2.2} aria-hidden className="shrink-0 text-support transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 p-4 pt-0">{children}</div>
    </details>
  );
}

/** Cartão. Cor de fundo e de borda podem ser trocadas pelo `className` (ex.: "bg-brand-soft border-brand/30"). */
export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-[20px] border p-4 shadow-sm ${/\bbg-/.test(className) ? "" : "bg-white"} ${/(^|\s)border-(brand|accent|slate|amber|red|blue|emerald|green|white|black)/.test(className) ? "" : "border-slate-200"} ${className}`}>{children}</section>
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-bold leading-5">{label}</span>
      {children}
      {hint ? <span className="text-base text-support">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "min-h-[60px] w-full rounded-2xl border-2 border-field bg-white px-4 text-xl outline-none focus:border-live focus:ring-2 focus:ring-live/30";

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={inputCls} />;
}

export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${inputCls} min-h-40 py-3`} />
}

/** Campo de texto que cresce em linhas em vez de cortar (endereços e nomes longos). Começa com 2 linhas. */
export function TextArea2(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [p.value]);
  return <textarea ref={ref} rows={2} {...p} className={`${inputCls} resize-none overflow-hidden py-3 leading-7`} />;
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
      aria-pressed={active}
      className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-[18px] text-lg font-bold ${active ? "border-brand bg-brand-soft text-brand" : "border-field bg-white text-ink"}`}
    >
      {active ? <Check size={20} strokeWidth={2.6} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Diminuir" className="grid h-12 w-12 place-items-center rounded-full bg-slate-100" onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={24} strokeWidth={2.2} aria-hidden />
      </button>
      <span className="w-8 text-center font-display text-xl font-bold">{value}</span>
      <button type="button" aria-label="Aumentar" className="grid h-12 w-12 place-items-center rounded-full bg-slate-100" onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={24} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}

export const Loading = () => <div className="grid min-h-dvh place-items-center text-lg text-support">Carregando…</div>;

/** Janela de confirmação para ações que não têm volta (apagar). */
export function ConfirmDialog({ open, title, text, confirmLabel = "Sim, apagar", confirmVariant = "danger-solid", onConfirm, onCancel }: {
  open: boolean; title: string; text: string; confirmLabel?: string; confirmVariant?: Variant; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-3xl bg-white p-5">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-lg text-support">{text}</p>
        <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
