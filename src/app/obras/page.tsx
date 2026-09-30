"use client";
import { Card, Chip, Loading, Screen } from "@/components/ui";
import { setWorkStatus, WORK_STATUS_LABEL } from "@/modules/works";
import { useAppDb } from "@/modules/useApp";
import type { WorkStatus } from "@/modules/types";
import { formatBRL } from "@/shared/money";
import { fmtDate } from "@/shared/format";

export default function Obras() {
  const db = useAppDb();
  if (!db) return <Loading />;
  return (
    <Screen title="Obras" nav>
      {db.works.length === 0 ? <p className="text-slate-500">Quando você fechar um orçamento, a obra aparece aqui.</p> : null}
      {db.works.map((w) => (
        <Card key={w.id} className="flex flex-col gap-2">
          <div className="text-lg font-semibold">{w.title}</div>
          <div className="text-slate-600">{formatBRL(w.plannedTotalCents)} · {w.plannedDays} dia(s) previstos · desde {fmtDate(w.createdAt)}</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((s) => (
              <Chip key={s} active={w.status === s} onClick={() => setWorkStatus(w.id, s)}>{WORK_STATUS_LABEL[s]}</Chip>
            ))}
          </div>
        </Card>
      ))}
    </Screen>
  );
}
