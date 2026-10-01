"use client";
import Link from "next/link";
import { Card, LinkButton, Loading, Screen } from "@/components/ui";
import { useAppDb } from "@/modules/useApp";
import { fmtDate } from "@/shared/format";

export default function Visitas() {
  const db = useAppDb();
  if (!db) return <Loading />;
  return (
    <Screen title="Visitas" nav>
      <LinkButton href="/visitas/nova">GRAVAR VISITA</LinkButton>
      {db.visits.length === 0 ? <p className="text-slate-500">Nenhuma visita ainda. Na obra, toque em GRAVAR VISITA e guarde fotos e observações.</p> : null}
      {db.visits.map((v) => (
        <Link key={v.id} href={`/visitas/${v.id}`}>
          <Card>
            <div className="flex justify-between gap-2">
              <b>{db.clients.find((c) => c.id === v.clientId)?.name}</b>
              <span className={v.quoteId ? "text-emerald-700" : "text-amber-700"}>{v.quoteId ? "Orçamento feito" : "Falta orçar"}</span>
            </div>
            <div className="text-sm text-slate-600">{fmtDate(v.createdAt)} · {v.photoIds.length} foto(s) · {(v.audios ?? []).length} áudio(s)</div>
            {v.notes ? <div className="mt-1 line-clamp-2 text-slate-700">{v.notes}</div> : null}
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
