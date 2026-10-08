"use client";
import { ExternalLink } from "lucide-react";
import { Loading, Screen } from "@/components/ui";
import { useAppDb } from "@/modules/useApp";
import { STORE_CATEGORIES, storeUrl } from "@/modules/store";

/** Loja: atalhos para comprar o material da obra. Os links abrem no navegador, fora do app. */
export default function Loja() {
  const db = useAppDb();
  if (!db) return <Loading />;
  return (
    <Screen title="Loja" nav>
      <p className="text-base leading-[22px] text-support">Atalhos para comprar o material da obra. Ao comprar por estes links, o Medde pode ganhar uma pequena comissão, sem custo extra para você.</p>
      {STORE_CATEGORIES.map((c) => (
        <section key={c.id} className="flex flex-col gap-2">
          <h2 className="px-1 font-display text-xl font-medium leading-[26px]">{c.title}</h2>
          <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgba(15,59,122,.05)] [&>*+*]:border-t [&>*+*]:border-line">
            {c.items.map((it) => (
              <a key={it.id} href={storeUrl(it.query)} target="_blank" rel="noopener noreferrer sponsored" className="flex min-h-[72px] items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-medium leading-6">{it.title}</span>
                  <span className="block text-base leading-[22px] text-support">{it.hint}</span>
                </span>
                <ExternalLink size={20} strokeWidth={2.2} aria-hidden className="shrink-0 text-support" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
