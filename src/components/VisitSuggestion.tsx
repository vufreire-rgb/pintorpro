"use client";
import { ClipboardList } from "lucide-react";
import { Button, Card } from "./ui";
import { fmtDate } from "@/shared/format";
import type { Db, Visit } from "@/modules/types";

/** A visita mais recente desse cliente que ainda não virou orçamento (com endereço ou observações para aproveitar). */
export function openVisitFor(db: Db, clientId: string): Visit | undefined {
  return db.visits
    .filter((v) => v.clientId === clientId && !v.quoteId && !v.isExample && (v.notes.trim() || v.siteAddress.trim()))
    .sort((a, b) => Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt))[0];
}

/** Aviso na tela do orçamento: "tem uma visita desse cliente sem orçamento, quer usar o endereço e as observações dela?" */
export function VisitSuggestion({ visit, onUse }: { visit: Visit | undefined; onUse: (v: Visit) => void }) {
  if (!visit) return null;
  return (
    <Card className="flex flex-col gap-2 border-brand/30 bg-brand-soft">
      <b className="inline-flex items-center gap-2"><ClipboardList size={20} aria-hidden />Visita de {fmtDate(visit.startedAt ?? visit.createdAt)} sem orçamento</b>
      <p className="text-base">Quer usar o endereço e as observações dela aqui?</p>
      <Button variant="ghost" size="sm" className="!bg-white" onClick={() => onUse(visit)}>Usar os dados da visita</Button>
    </Card>
  );
}
