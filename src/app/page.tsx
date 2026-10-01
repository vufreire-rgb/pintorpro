"use client";
import { Card, LinkButton, Loading, Screen } from "@/components/ui";
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
      <LinkButton href="/visitas/nova">GRAVAR VISITA</LinkButton>
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
