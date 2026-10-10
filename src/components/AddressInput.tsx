"use client";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { Button, Field, TextArea2 } from "./ui";
import { GEO_MESSAGE, GeoError, getPosition, reverseGeocode } from "@/modules/geo";

/**
 * Campo de endereço com "Usar minha localização": pega a posição do celular, descobre a rua e preenche.
 * Só roda quando a pessoa toca no botão. `onPoint` (opcional) recebe o ponto no mapa, para quem guarda a localização.
 */
export function AddressInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (text: string) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const locate = async () => {
    setBusy(true);
    setMsg("");
    try {
      const found = await reverseGeocode(await getPosition());
      if (found) {
        onChange(found.text);
        setMsg(found.hasNumber ? "Endereço preenchido. Confira se está certo." : "Preenchi a rua. Falta o número: complete acima.");
      } else setMsg("Achei sua posição, mas não consegui descobrir o nome da rua. Digite o endereço.");
    } catch (e) {
      setMsg(e instanceof GeoError ? GEO_MESSAGE[e.reason] : GEO_MESSAGE.unavailable);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint}><TextArea2 aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} /></Field>
      <Button variant="ghost" size="sm" icon={MapPin} disabled={busy} onClick={() => void locate()}>{busy ? "Buscando sua posição…" : "Usar minha localização"}</Button>
      {msg ? <p role="status" className="text-base text-ink">{msg}</p> : null}
    </div>
  );
}
