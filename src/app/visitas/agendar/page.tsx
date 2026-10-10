"use client";
import { DictationField } from "@/components/DictationField";
import { AddressInput } from "@/components/AddressInput";
import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, Loading, Screen, TextInput } from "@/components/ui";
import { createScheduledVisit } from "@/modules/visits";
import { fromLocalInput, toLocalInput } from "@/modules/visitList";
import { useAppDb } from "@/modules/useApp";

const tomorrowAt9 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

export default function AgendarVisita() {
  const db = useAppDb();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  const [when, setWhen] = useState(tomorrowAt9);
  const [notes, setNotes] = useState("");
  if (!db) return <Loading />;
  const chosen = db.clients.find((c) => c.id === clientId);
  const ok = !!when && (clientId || f.name.trim() || f.address.trim());
  return (
    <Screen title="Agendar visita" back="/visitas">
      <Field label="Dia e hora"><TextInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      {db.clients.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Cliente</p>
          <div className="flex flex-wrap gap-2">
            {db.clients.map((c) => <Chip key={c.id} active={clientId === c.id} onClick={() => setClientId(clientId === c.id ? "" : c.id)}>{c.name}</Chip>)}
          </div>
        </div>
      ) : null}
      {!clientId ? (
        <Card className="flex flex-col gap-3">
          <b>Novo cliente (pode deixar em branco e preencher depois)</b>
          <Field label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone (WhatsApp)"><TextInput type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </Card>
      ) : null}
      <AddressInput label="Endereço da visita" value={f.address || chosen?.address || ""} onChange={(t) => setF({ ...f, address: t })} />
      <DictationField label="Anotação (opcional)" value={notes} onChange={setNotes} placeholder="Ex.: portão azul, tocar interfone 32" />
      <Button icon={CalendarPlus} disabled={!ok} onClick={() => router.push(`/visitas/${createScheduledVisit(db, { clientId, ...f, address: f.address || chosen?.address || "", scheduledAt: fromLocalInput(when), notes })}`)}>Agendar</Button>
    </Screen>
  );
}
