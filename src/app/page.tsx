"use client";
import Link from "next/link";
import { QuickVisitButton } from "@/components/QuickVisitButton";
import { Card, LinkButton, Loading, Screen } from "@/components/ui";
import { whenLabel, visitState } from "@/modules/visitList";
import { dashboard } from "@/modules/dashboard";
import { useAppDb } from "@/modules/useApp";
import { formatBRL } from "@/shared/money";

export default function Painel() {
  const db = useAppDb();
  if (!db) return <Loading />;
  const d = dashboard(db);
  const stat = (label: string, value: string) => (
    <Card>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
  return (
    <Screen title={`Olá, ${db.company!.name}`} nav>
      <QuickVisitButton />
      <LinkButton href="/visitas/agendar" variant="ghost">📅 Agendar visita</LinkButton>
      {d.nextVisits.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <b>Próximas visitas</b>
          {d.nextVisits.map((v) => (
            <Link key={v.id} href={`/visitas/${v.id}`} className="flex justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <span className="truncate font-medium">{db.clients.find((c) => c.id === v.clientId)?.name || v.siteAddress || "Visita"}</span>
              <span className={visitState(v) === "late" ? "shrink-0 text-red-700" : "shrink-0 text-brand"}>{whenLabel(v.scheduledAt!)}</span>
            </Link>
          ))}
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/orcamentos/novo" variant="ghost">Orçar rápido</LinkButton>
        <LinkButton href="/clientes" variant="ghost">Clientes</LinkButton>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stat("Visitas sem orçamento", String(d.visitsPending))}
        {stat(`Em aberto (${d.openCount})`, formatBRL(d.openCents))}
        {stat("Vendido no mês", formatBRL(d.soldMonthCents))}
        {stat("Lucro estimado do mês", formatBRL(d.profitMonthCents))}
        {stat("Obras em andamento", String(d.worksActive))}
        {stat("Próximas obras", String(d.worksNext))}
        {stat("Taxa de fechamento", d.closeRate === null ? "—" : `${Math.round(d.closeRate * 100)}%`)}
      </div>
    </Screen>
  );
}
