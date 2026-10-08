"use client";
import { useDb } from "@/modules/db";
import { useFileUrl } from "@/modules/photos";
import { initialsOf } from "@/modules/pdfData";

const greeting = (h = new Date().getHours()) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");

function Logo({ id }: { id: string }) {
  const url = useFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="h-full w-full object-contain" /> : null;
}

/** Logo (ou iniciais na cor do pintor). `size` em pixels. */
export function BrandMark({ size = 48 }: { size?: number }) {
  const c = useDb()?.company;
  if (!c) return null;
  const color = c.brandColor ?? "#0F3B7A";
  return (
    <div
      data-testid="brand-mark"
      className={`grid shrink-0 place-items-center overflow-hidden font-display font-extrabold tracking-tight ${c.logoId ? "border border-slate-200 bg-white" : "text-white"}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.29), fontSize: Math.round(size * 0.42), ...(c.logoId ? {} : { backgroundColor: color }) }}
    >
      {c.logoId ? <Logo id={c.logoId} /> : initialsOf(c.name)}
    </div>
  );
}

/** Topo do app: quem aparece é o pintor (logo ou iniciais na cor dele, nome do negócio e saudação). A marca do app fica de fora. */
export function BrandHeader() {
  const c = useDb()?.company;
  if (!c) return null;
  const color = c.brandColor ?? "#0F3B7A";
  const first = (c.ownerName ?? "").trim().split(/\s+/)[0] ?? "";
  return (
    <div className="flex items-center gap-3.5">
      <div
        data-testid="brand-mark"
        className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] font-display text-xl font-extrabold tracking-tight ${c.logoId ? "border border-slate-200 bg-white" : "text-white"}`}
        style={c.logoId ? undefined : { backgroundColor: color }}
      >
        {c.logoId ? <Logo id={c.logoId} /> : initialsOf(c.name)}
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-[22px] font-bold leading-7" style={{ color }} data-testid="brand-name">{c.name}</div>
        <div className="text-base text-support">{greeting()}{first ? `, ${first}` : ""}</div>
      </div>
    </div>
  );
}
