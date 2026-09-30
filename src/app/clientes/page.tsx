"use client";
import { useState } from "react";
import { Button, Card, Field, Loading, Screen, TextInput } from "@/components/ui";
import { addClient } from "@/modules/clients";
import { useAppDb } from "@/modules/useApp";

export default function Clientes() {
  const db = useAppDb();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  if (!db) return <Loading />;
  return (
    <Screen title="Clientes" nav>
      {open ? (
        <Card className="flex flex-col gap-3">
          <Field label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone"><TextInput type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Endereço"><TextInput value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Button disabled={!f.name.trim()} onClick={() => { addClient(f); setF({ name: "", phone: "", address: "" }); setOpen(false); }}>Salvar cliente</Button>
        </Card>
      ) : <Button onClick={() => setOpen(true)}>+ Novo cliente</Button>}
      {db.clients.length === 0 ? <p className="text-slate-500">Nenhum cliente ainda.</p> : null}
      {db.clients.map((c) => (
        <Card key={c.id}>
          <div className="text-lg font-semibold">{c.name}</div>
          <div className="text-slate-600">{c.phone}</div>
          <div className="text-slate-600">{c.address}</div>
        </Card>
      ))}
    </Screen>
  );
}
