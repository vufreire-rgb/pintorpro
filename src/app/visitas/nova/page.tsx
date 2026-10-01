"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, Loading, Screen, TextInput } from "@/components/ui";
import { createVisit } from "@/modules/visits";
import { useAppDb } from "@/modules/useApp";

export default function NovaVisita() {
  const db = useAppDb();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  if (!db) return <Loading />;
  const chosen = db.clients.find((c) => c.id === clientId);
  const ok = clientId || f.name.trim();
  return (
    <Screen title="Gravar visita" back="/visitas">
      <p className="text-slate-600">Primeiro, para quem é esta visita? Depois você guarda as fotos e observações.</p>
      {db.clients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {db.clients.map((c) => <Chip key={c.id} active={clientId === c.id} onClick={() => setClientId(clientId === c.id ? "" : c.id)}>{c.name}</Chip>)}
        </div>
      )}
      {!clientId ? (
        <Card className="flex flex-col gap-3">
          <Field label="Nome do cliente"><TextInput autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Endereço da obra"><TextInput value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </Card>
      ) : (
        <Field label="Endereço da obra"><TextInput value={f.address || chosen?.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      )}
      <Button disabled={!ok} onClick={() => router.push(`/visitas/${createVisit(db, { clientId, ...f })}`)}>Começar</Button>
    </Screen>
  );
}
