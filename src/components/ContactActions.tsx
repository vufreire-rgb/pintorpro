"use client";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { mapsUrl, telUrl, waUrl } from "@/modules/visitList";

const cls = "inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border-2 border-brand bg-white px-1 font-display text-base font-bold text-brand active:bg-brand-soft";
const ic = { size: 20, strokeWidth: 2.2, "aria-hidden": true } as const;

/** Atalhos para o pintor: ligar, WhatsApp e abrir o endereço no mapa. Só aparece o que existe. */
export function ContactActions({ phone, address, location }: { phone?: string; address?: string; location?: { lat: number; lng: number } }) {
  if (!phone && !address && !location) return null;
  return (
    <div className="flex gap-2">
      {phone ? <a className={cls} href={telUrl(phone)}><Phone {...ic} />Ligar</a> : null}
      {phone ? <a className={cls} href={waUrl(phone)} target="_blank" rel="noreferrer"><MessageCircle {...ic} />WhatsApp</a> : null}
      {address || location ? <a className={cls} href={mapsUrl(address ?? "", location)} target="_blank" rel="noreferrer"><MapPin {...ic} />Mapa</a> : null}
    </div>
  );
}
