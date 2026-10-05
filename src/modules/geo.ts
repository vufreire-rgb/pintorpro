import type { GeoPoint } from "./types";

/** Localização do aparelho + endereço escrito (OpenStreetMap). */

export class GeoError extends Error {
  constructor(public reason: "denied" | "unavailable" | "timeout" | "unsupported") {
    super(reason);
  }
}

export const GEO_MESSAGE: Record<GeoError["reason"], string> = {
  denied: "O celular não deixou o app usar a localização. Ative a localização para este site nas configurações do navegador e tente de novo.",
  unavailable: "Não consegui achar sua posição. Vá para um lugar aberto e tente de novo.",
  timeout: "Demorou demais para achar sua posição. Tente de novo.",
  unsupported: "Este aparelho não oferece localização.",
};

/** Pede a posição ao celular (só roda quando o pintor toca no botão). */
export function getPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new GeoError("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new GeoError(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

interface NominatimReverse {
  address?: Record<string, string>;
}

/** "Rua das Flores, 120 - Centro, Campinas - SP". Sem rua, devolve "". */
export function addressFromNominatim(json: NominatimReverse): { text: string; hasNumber: boolean } {
  const a = json.address ?? {};
  const road = a.road ?? a.pedestrian ?? a.residential ?? a.path ?? "";
  if (!road) return { text: "", hasNumber: false };
  const number = a.house_number ?? "";
  const district = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? "";
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const uf = (a["ISO3166-2-lvl4"] ?? "").replace(/^BR-/, "");
  const street = number ? `${road}, ${number}` : road;
  const place = [city, uf].filter(Boolean).join(" - ");
  const text = [street, district].filter(Boolean).join(" - ") + (place ? `, ${place}` : "");
  return { text, hasNumber: !!number };
}

/** Descobre o endereço escrito do ponto. Falha (internet, serviço fora) devolve null: o ponto no mapa continua valendo. */
export async function reverseGeocode(p: GeoPoint): Promise<{ text: string; hasNumber: boolean } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=${p.lat}&lon=${p.lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const r = addressFromNominatim((await res.json()) as NominatimReverse);
    return r.text ? r : null;
  } catch {
    return null;
  }
}
