"use client";
import { useEffect, useState } from "react";
import { qrDataUrl } from "@/modules/qr";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui";

/** Mostra o QR Code do Pix (para o cliente escanear na hora) e o "copia e cola". */
export function PixModal({ code, title, amount, onClose }: { code: string; title: string; amount: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    qrDataUrl(code).then((u) => alive && setQr(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [code]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Pix">
      <div className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-3xl bg-white p-5">
        <h2 className="font-display text-[22px] font-bold leading-7">{title}</h2>
        <div className="font-display text-[40px] font-extrabold leading-[44px] text-brand">{amount}</div>
        <div className="grid place-items-center rounded-2xl bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code do Pix" className="h-64 w-64" data-testid="pix-qr" />
          ) : <div className="h-64 w-64 animate-pulse rounded-xl bg-slate-100" />}
        </div>
        <p className="break-all rounded-xl bg-slate-50 p-3 text-base text-support" data-testid="pix-code">{code}</p>
        <Button icon={copied ? Check : Copy} onClick={copy}>{copied ? "Copiado" : "Copiar Pix copia e cola"}</Button>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}
