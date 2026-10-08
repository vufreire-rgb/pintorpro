"use client";
import { Chip } from "./ui";
import { SERVICE_GROUP_LABEL, serviceGroup } from "@/modules/catalog";

interface Svc { id: string; name: string }

/** Serviços do ambiente: um resumo do que está marcado e, ao tocar em "Mudar serviços", os grupos Preparação, Pintura e Extras. */
export function ServicePicker({ services, selected, onToggle }: { services: Svc[]; selected: string[]; onToggle: (id: string) => void }) {
  const chosen = services.filter((s) => selected.includes(s.id));
  const groups = (["prep", "paint", "extra"] as const).map((g) => ({ g, items: services.filter((s) => serviceGroup(s.id) === g) })).filter((x) => x.items.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base"><b>Serviços:</b> {chosen.length ? chosen.map((s) => s.name).join(" · ") : <span className="text-err">nenhum escolhido</span>}</p>
      <details open={chosen.length === 0} className="rounded-2xl border border-line p-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-bold text-brand">Mudar serviços</summary>
        <div className="mt-3 flex flex-col gap-3">
          {groups.map(({ g, items }) => (
            <div key={g} className="flex flex-col gap-2">
              <b className="text-base text-support">{SERVICE_GROUP_LABEL[g]}</b>
              <div className="flex flex-wrap gap-2">
                {items.map((s) => <Chip key={s.id} active={selected.includes(s.id)} onClick={() => onToggle(s.id)}>{s.name}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
