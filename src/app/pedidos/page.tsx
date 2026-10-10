"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle, Trash2, UserPlus, X, Settings } from "lucide-react";
import { SwipeRow } from "@/components/SwipeRow";
import { UndoBar } from "@/components/UndoBar";
import { Badge, Button, Card, LinkButton, Loading, Screen } from "@/components/ui";
import { cloudEnabled } from "@/modules/auth";
import { markRequest, phoneLabel, removeRequest, requestWhatsApp, useMyPage, useRequests, visitFromRequest, type RequestRow } from "@/modules/publicPage";
import { agoLabel } from "@/modules/quoteLinks";
import { useAppDb } from "@/modules/useApp";
import { useHint } from "@/modules/hints";

const STATUS: Record<RequestRow["status"], { label: string; tone: "open" | "ok" | "lost" | "warn" }> = {
  new: { label: "Novo", tone: "warn" },
  contacted: { label: "Contatado", tone: "open" },
  converted: { label: "Virou visita", tone: "ok" },
  dismissed: { label: "Descartado", tone: "lost" },
};

/** Pedidos de orçamento que chegaram pela página pública do pintor. */
export default function Pedidos() {
  const db = useAppDb();
  const router = useRouter();
  const { requests, failed, reload } = useRequests();
  const hint = useHint("pedidos", requests.length > 0);
  const { page } = useMyPage();
  const [err, setErr] = useState("");
  const [undo, setUndo] = useState<{ message: string; back: () => void } | null>(null);
  if (!db) return <Loading />;
  const company = db.company?.name ?? "";
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch { setErr("Não consegui atualizar agora. Verifique a internet e tente de novo."); } };
  const fresh = requests.filter((r) => r.status === "new");
  const older = requests.filter((r) => r.status !== "new");
  const makeVisit = (r: RequestRow) => void act(async () => { const vid = visitFromRequest(db, r); await markRequest(r.id, "converted"); router.push(`/visitas/${vid}`); });
  const dismiss = (r: RequestRow) => { const prev = r.status; void act(() => markRequest(r.id, "dismissed")); setUndo({ message: `Descartado: ${r.name}.`, back: () => void act(() => markRequest(r.id, prev)) }); };
  const one = (r: RequestRow) => (
    <SwipeRow
      key={r.id}
      right={r.status === "converted" ? undefined : { label: "Criar visita", icon: <UserPlus size={24} aria-hidden />, className: "bg-[#0A8545]" }}
      left={r.status === "dismissed" ? undefined : { label: "Descartar", icon: <X size={24} aria-hidden />, className: "bg-[#5B6B80]" }}
      onRight={() => makeVisit(r)}
      onLeft={() => dismiss(r)}
    >
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate font-display text-lg font-semibold">{r.name}</div><div className="text-base text-support">{phoneLabel(r.phone)} · {agoLabel(r.created_at)}</div></div>
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
      </div>
      {r.address ? <div className="text-base">📍 {r.address}</div> : null}
      {r.message ? <p className="whitespace-pre-wrap rounded-2xl bg-[#F3F6FA] p-3 text-base">{r.message}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" icon={MessageCircle} onClick={() => { window.open(requestWhatsApp(r, company), "_blank"); if (r.status === "new") void act(() => markRequest(r.id, "contacted")); }}>WhatsApp</Button>
        <Button variant="ghost" size="sm" icon={UserPlus} onClick={() => makeVisit(r)}>Criar visita</Button>
      </div>
      <Button variant="danger" icon={Trash2} onClick={() => void act(() => removeRequest(r.id))}>Apagar</Button>
    </Card>
    </SwipeRow>
  );
  return (
    <Screen title="Pedidos de clientes" back="/orcamentos">
      <div className="flex flex-col gap-4 pb-8">
        {!cloudEnabled ? <Card>Os pedidos pela página precisam de uma conta com internet.</Card> : null}
        {failed ? (
          <Card className="flex flex-col gap-2">
            <b>Não consegui carregar os pedidos agora</b>
            <p className="text-base text-support">Verifique a internet e tente de novo. Os pedidos continuam guardados.</p>
            <Button variant="ghost" onClick={reload}>Tentar de novo</Button>
          </Card>
        ) : null}
        {err ? <p role="alert" className="text-base text-err">{err}</p> : null}
        {cloudEnabled && !page?.enabled ? (
          <Card className="flex flex-col gap-2">
            <b>Sua página para receber pedidos está desligada</b>
            <p className="text-base text-support">Ative em Ajustes e divulgue o link. O cliente preenche e o pedido aparece aqui.</p>
            <LinkButton href="/configuracoes" variant="ghost" icon={Settings}>Ir para Ajustes</LinkButton>
          </Card>
        ) : null}
        {hint && requests.length > 0 ? <p className="text-base text-support">Dica: deslize o pedido para a direita para criar a visita, ou para a esquerda para descartar.</p> : null}
        {fresh.length ? <h2 className="font-display text-xl font-semibold">Novos ({fresh.length})</h2> : null}
        {fresh.map(one)}
        {older.length ? <h2 className="font-display text-xl font-semibold">Anteriores</h2> : null}
        {older.map(one)}
        {cloudEnabled && requests.length === 0 ? <p className="text-lg text-support">Nenhum pedido ainda. Quando alguém pedir pelo seu link, aparece aqui.</p> : null}
        {undo ? <UndoBar message={undo.message} onUndo={() => { undo.back(); setUndo(null); }} onDone={() => setUndo(null)} /> : null}
      </div>
    </Screen>
  );
}
