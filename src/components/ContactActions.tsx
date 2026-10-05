"use client";
import { mapsUrl, telUrl, waUrl } from "@/modules/visitList";

const cls = "grid min-h-12 flex-1 place-items-center whitespace-nowrap rounded-xl bg-slate-100 px-2 text-[15px] font-semibold active:bg-slate-200";

/** Atalhos para o pintor: ligar, WhatsApp e abrir o endereço no mapa. Só aparece o que existe. */
export function ContactActions({ phone, address, location }: { phone?: string; address?: string; location?: { lat: number; lng: number } }) {
  if (!phone && !address && !location) return null;
  return (
    <div className="flex gap-2">
      {phone ? <a className={cls} href={telUrl(phone)}>📞 Ligar</a> : null}
      {phone ? <a className={cls} href={waUrl(phone)} target="_blank" rel="noreferrer">💬 WhatsApp</a> : null}
      {address || location ? <a className={cls} href={mapsUrl(address ?? "", location)} target="_blank" rel="noreferrer">📍 Mapa</a> : null}
    </div>
  );
}
