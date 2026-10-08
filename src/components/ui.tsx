"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, FileText, MapPin, Minus, PaintRoller, Plus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { fmtNum, parseNum } from "@/shared/format";

export function Screen({ title, back, children, nav = false, corner }: { title: string; back?: string; children: React.ReactNode; nav?: boolean; corner?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex min-h-[72px] items-center gap-3 border-b border-line bg-white px-5 py-3">
        {back ? (
          <Link href={back} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F3F6FA] text-ink" aria-label="Voltar">
            <ArrowLeft size={24} strokeWidth={2.2} aria-hidden />
          </Link>
        ) : null}
        <h1 className={`min-w-0 font-display font-semibold ${nav ? "text-[28px] leading-[34px]" : "text-2xl leading-[30px]"}`}>{title}</h1>
        {corner ? <div className="ml-auto">{corner}</div> : null}
      </header>
      <main className={`flex flex-1 flex-col gap-3.5 px-5 py-4 ${nav ? "pb-28" : "pb-8"}`}>{children}</main>
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
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-20 max-w-md grid-cols-4 items-center border-t border-line bg-white px-1 pb-[env(safe-area-inset-bottom)]">
      {NAV.map(([href, label, Icon]) => {
        const here = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={here ? "page" : undefined} className={`flex flex-col items-center gap-1 text-[14px] leading-4 ${here ? "font-bold text-brand" : "font-normal text-support"}`}>
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
type Size = "md" | "sm";
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; size?: Size };
/** primary/success = a ação principal da tela (verde, só uma por tela). ghost = secundário. danger = só texto vermelho ("Apagar"). */
const VARIANT: Record<Variant, string> = {
  primary: "min-h-16 bg-accent-dark text-xl font-semibold uppercase tracking-[0.02em] text-white active:bg-accent-dark/90",
  success: "min-h-16 bg-accent-dark text-xl font-semibold uppercase tracking-[0.02em] text-white active:bg-accent-dark/90",
  ghost: "min-h-14 bg-brand-soft text-lg font-semibold text-brand active:bg-brand-soft/70 disabled:text-support",
  danger: "min-h-12 bg-transparent text-lg font-semibold text-err active:bg-red-50",
  "danger-solid": "min-h-14 bg-err text-lg font-semibold text-white active:opacity-90",
};
const BASE = "inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 font-display disabled:opacity-50";

/** Classe de botão para links <a> externos. */
export const buttonCls = (variant: Variant = "ghost", extra = ""): string => `${BASE} ${VARIANT[variant]} ${extra}`;

/** Pílula de ação: altura 48, largura mínima 96, raio 24, texto 17. */
const SMALL = "!min-h-12 !min-w-24 !gap-2 !rounded-3xl !px-4 !text-[17px]";

export function Button({ variant = "primary", className = "", icon: Icon, size = "md", children, ...p }: BtnProps) {
  return (
    <button {...p} className={`${BASE} ${VARIANT[variant]} ${size === "sm" ? SMALL : ""} ${className}`}>
      {Icon ? <Icon size={size === "sm" ? 20 : 24} strokeWidth={2.2} aria-hidden className="shrink-0" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className = "", icon: Icon, size = "md", "aria-label": ariaLabel }: { href: string; children: React.ReactNode; variant?: Variant; className?: string; icon?: LucideIcon; size?: Size; "aria-label"?: string }) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`${BASE} ${VARIANT[variant]} ${size === "sm" ? SMALL : ""} ${className}`}>
      {Icon ? <Icon size={size === "sm" ? 20 : 24} strokeWidth={2.2} aria-hidden className="shrink-0" /> : null}
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

/** Régua de passos: uma linha fina com uma marca por passo (feitos em verde, o atual com a marca maior). */
export function Ruler({ total, current, label }: { total: number; current: number; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-base text-support">Passo <b className="text-ink">{current + 1}</b> de <b className="text-ink">{total}</b>{label ? <> · <b className="text-ink">{label}</b></> : null}</div>
      <div className="flex h-9 items-end" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`relative h-9 flex-1 border-b-[3px] ${i < current ? "border-[#0A8545]" : "border-[#D3DBE6]"}`}>
            <span className={`absolute bottom-0 left-0 w-[3px] rounded-sm ${i <= current ? "bg-[#0A8545]" : "bg-[#D3DBE6]"} ${i === current ? "h-[26px]" : "h-[14px]"}`} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Título de cartão com ícone de traço (sem emoji). */
export function CardTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-medium leading-[26px]">
      {Icon ? <Icon size={24} strokeWidth={2.2} aria-hidden className="shrink-0 text-brand" /> : null}
      {children}
    </h2>
  );
}

/** Botão pequeno de ação dentro de um cartão (secundário, com ícone). */
export const ACTION_CLS = "inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-3xl bg-brand-soft px-2 font-display text-[17px] font-semibold text-brand active:bg-brand-soft/70 disabled:opacity-50";

/** Bloco que abre e fecha (para telas longas, como Ajustes). */
const ROW = "flex min-h-[88px] items-center gap-3 px-4 py-2";

function RowIcon({ icon: Icon }: { icon?: LucideIcon }) {
  return Icon ? <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon size={24} strokeWidth={2.2} aria-hidden /></span> : null;
}

/** Etiqueta pequena à direita da linha: mostra de relance se o recurso está ligado. */
function RowBadge({ badge }: { badge?: { text: string; ok?: boolean } }) {
  return badge ? <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${badge.ok ? "bg-[#E3F4EA] text-[#07602F]" : "bg-[#F3F6FA] text-support"}`}>{badge.text}</span> : null;
}

/** Lista de ajustes: várias linhas num cartão só, separadas por um fio (mais limpo que um cartão por linha). */
export function SectionGroup({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgba(15,59,122,.05)] [&>*+*]:border-t [&>*+*]:border-line">{children}</div>;
}

/** Linha de ajuste que abre e fecha (Bloco Recolhível dentro de um SectionGroup): ícone, título curto, resumo, etiqueta de estado e seta. */
export function Section({ title, hint, icon, badge, open = false, children }: { title: string; hint?: string; icon?: LucideIcon; badge?: { text: string; ok?: boolean }; open?: boolean; children: React.ReactNode }) {
  return <BlocoRecolhivel bare title={title} icon={icon} summary={hint} badge={badge} defaultOpen={open}>{children}</BlocoRecolhivel>;
}

/** Linha de ajuste que leva a outra tela. */
export function SectionLink({ href, title, hint, icon }: { href: string; title: string; hint?: string; icon?: LucideIcon }) {
  return (
    <Link href={href} className={ROW}>
      <RowIcon icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-medium leading-[26px]">{title}</span>
        {hint ? <span className="block truncate text-base leading-[22px] text-support">{hint}</span> : null}
      </span>
      <ChevronRight size={22} strokeWidth={2.2} aria-hidden className="shrink-0 text-support" />
    </Link>
  );
}

/** Cartão. Cor de fundo e de borda podem ser trocadas pelo `className` (ex.: "bg-brand-soft border-brand/30"). */
export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-[20px] border p-4 shadow-[0_1px_2px_rgba(15,59,122,.05)] ${/\bbg-/.test(className) ? "" : "bg-white"} ${/(^|\s)border-(brand|accent|slate|amber|red|blue|emerald|green|white|black)/.test(className) ? "" : "border-line"} ${className}`}>{children}</section>
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-normal leading-[22px] text-support">{label}</span>
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
      className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-[18px] text-lg font-normal ${active ? "border-brand bg-brand-soft text-ink" : "border-field bg-white text-ink"}`}
    >
      {active ? <Check size={20} strokeWidth={2.6} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Diminuir" className="grid h-12 w-12 place-items-center rounded-full bg-[#F3F6FA]" onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={24} strokeWidth={2.2} aria-hidden />
      </button>
      <span className="w-8 text-center font-display text-xl font-semibold">{value}</span>
      <button type="button" aria-label="Aumentar" className="grid h-12 w-12 place-items-center rounded-full bg-[#F3F6FA]" onClick={() => onChange(Math.min(max, value + 1))}>
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

/**
 * Bloco recolhível (padrão "leve"): círculo de ícone, nome, resumo de uma linha, pílula opcional e seta.
 * Começa fechado. O conteúdo fica sempre montado (só escondido), então nada que esteja dentro perde o estado.
 * Abre sozinho e não fecha enquanto `openWhen` for verdadeiro (gravando, erro de validação, item novo) ou quando algo dentro recebe foco.
 */
export function BlocoRecolhivel({ title, icon: Icon, summary, badge, bare = false, action, openWhen = false, openSignal = 0, defaultOpen = false, children }: {
  title: string; icon?: LucideIcon; summary?: string;
  /** Etiqueta de estado à direita do resumo (Ajustes). */ badge?: { text: string; ok?: boolean };
  /** Sem cartão próprio: para dentro de um SectionGroup. */ bare?: boolean;
  action?: { label: string; ariaLabel?: string; icon?: LucideIcon; onClick?: () => void; opens?: boolean; disabled?: boolean };
  openWhen?: boolean; /** Muda de valor quando algo foi adicionado: abre o bloco. */ openSignal?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openWhen) setOpen(true);
  }, [openWhen]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openSignal) setOpen(true);
  }, [openSignal]);
  const shown = open || openWhen;
  return (
    <section className={bare ? "" : "overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgba(15,59,122,.05)]"}>
      <div className="flex min-h-[88px] items-center gap-2 px-4">
        <button type="button" aria-expanded={shown} aria-controls={bodyId} onClick={() => setOpen(!shown)} className="flex min-h-[88px] min-w-0 flex-1 items-center gap-3 text-left">
          {Icon ? <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon size={24} strokeWidth={2.2} aria-hidden /></span> : null}
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-medium leading-[26px]">{title}</span>
            {summary ? <span className="line-clamp-2 text-base leading-[22px] text-support">{summary}</span> : null}
          </span>
        </button>
        <RowBadge badge={badge} />
        {action ? (
          <button type="button" aria-label={action.ariaLabel} disabled={action.disabled} onClick={() => { if (action.opens) setOpen(true); action.onClick?.(); }} className="inline-flex min-h-12 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-3xl bg-brand-soft px-4 font-display text-[17px] font-semibold text-brand active:bg-brand-soft/70 disabled:opacity-50">
            {action.label}
          </button>
        ) : null}
        <ChevronDown size={20} strokeWidth={2.2} aria-hidden onClick={() => setOpen(!shown)} className={`shrink-0 text-support transition-transform duration-150 motion-reduce:transition-none ${shown ? "rotate-180" : ""}`} />
      </div>
      <div id={bodyId} className={`grid transition-[grid-template-rows,visibility] duration-150 motion-reduce:transition-none ${shown ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`} onFocusCapture={() => setOpen(true)}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-line p-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Linha de dado: círculo de ícone, rótulo, valor (até 2 linhas) e seta. Tocar abre o campo no lugar;
 * com o valor vazio, já abre para editar. As ações ligadas ao campo (`actions`) aparecem logo abaixo.
 */
export function LinhaDeDado({ icon: Icon, label, value, editor, actions, openWhen = false }: { icon?: LucideIcon; label: string; value: string; editor: React.ReactNode; actions?: React.ReactNode; openWhen?: boolean }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openWhen) setOpen(true);
  }, [openWhen]);
  const editing = open || openWhen || !value.trim();
  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgba(15,59,122,.05)]">
      <button type="button" aria-expanded={editing} aria-controls={bodyId} onClick={() => setOpen(!editing)} className="flex min-h-[88px] w-full items-center gap-3 px-4 py-3 text-left">
        {Icon ? <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon size={24} strokeWidth={2.2} aria-hidden /></span> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-base leading-[22px] text-support">{label}</span>
          {editing ? null : <span className="line-clamp-2 break-words text-lg leading-[26px]">{value}</span>}
        </span>
        <ChevronDown size={20} strokeWidth={2.2} aria-hidden className={`shrink-0 text-support transition-transform duration-150 motion-reduce:transition-none ${editing ? "rotate-180" : ""}`} />
      </button>
      <div id={bodyId} hidden={!editing} className="flex flex-col gap-3 px-4 pb-4">
        {editor}
        {actions}
      </div>
    </section>
  );
}

/** Cartão de observação: o próprio cartão é o campo (sem caixa interna). Foco = borda 2 azul e halo; ditar fica num círculo à direita. */
export function CartaoDeObservacao({ label, hint, mic, children }: { label: string; hint?: string; mic?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,59,122,.05)] focus-within:border-2 focus-within:border-live focus-within:p-[15px] focus-within:shadow-[0_0_0_4px_#E8EFFA]">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base leading-[22px] text-support">{label}</span>
        {children}
        {hint ? <span className="text-base leading-[22px] text-support">{hint}</span> : null}
      </span>
      {mic ? <span className="shrink-0">{mic}</span> : null}
    </label>
  );
}

/** Campo de texto sem caixa, para dentro de um CartaoDeObservacao: cresce com o texto. */
export const bareTextCls = "min-h-24 w-full resize-none bg-transparent text-lg leading-[26px] outline-none placeholder:text-support/70";

/** Abas (segmentadas): ativa = fundo azul névoa + texto azul semibold; inativa = sem fundo, texto de apoio normal. */
export const TAB_LIST_CLS = "grid gap-1 rounded-2xl bg-white p-1 border border-line";
export const tabCls = (active: boolean): string => `flex min-h-12 items-center justify-center gap-2 rounded-xl px-1 text-base leading-tight ${active ? "bg-brand-soft font-display font-semibold text-brand" : "font-normal text-support"}`;
