"use client";
import { AddressInput } from "@/components/AddressInput";
import { Check, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Button, Card, ConfirmDialog, Field, Loading, Screen, TextInput } from "@/components/ui";
import { addClient, deleteClient, updateClient } from "@/modules/clients";
import { useAppDb } from "@/modules/useApp";

const EMPTY = { name: "", phone: "", address: "" };

export default function Clientes() {
  const db = useAppDb();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [f, setF] = useState(EMPTY);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [blocked, setBlocked] = useState("");
  if (!db) return <Loading />;

  const open = (id: string | "new") => {
    const c = db.clients.find((x) => x.id === id);
    setF(c ? { name: c.name, phone: c.phone, address: c.address } : EMPTY);
    setEditing(id);
    setBlocked("");
  };
  const save = () => {
    if (editing === "new") addClient(f);
    else if (editing) updateClient(editing, f);
    setEditing(null);
    setF(EMPTY);
  };
  const target = db.clients.find((c) => c.id === askDelete);

  return (
    <Screen title="Clientes" nav>
      {editing ? (
        <Card className="flex flex-col gap-3">
          <Field label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone"><TextInput type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <AddressInput label="Endereço" value={f.address} onChange={(t) => setF({ ...f, address: t })} />
          <Button icon={Check} disabled={!f.name.trim()} onClick={save}>{editing === "new" ? "Salvar cliente" : "Salvar alterações"}</Button>
          <Button variant="ghost" size="sm" icon={X} onClick={() => setEditing(null)}>Cancelar</Button>
        </Card>
      ) : <Button icon={UserPlus} onClick={() => open("new")}>Novo cliente</Button>}
      {blocked ? <p className="rounded-2xl bg-[#FFF3D6] p-3 text-[#8A4B00]">{blocked}</p> : null}
      {db.clients.length === 0 ? <p className="text-support">Nenhum cliente ainda.</p> : null}
      {db.clients.map((c) => (
        <Card key={c.id} className="flex flex-col gap-2">
          <div>
            <div className="text-lg font-semibold">{c.name}</div>
            <div className="text-support">{c.phone}</div>
            <div className="text-support">{c.address}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => open(c.id)}>Editar</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setBlocked(""); setAskDelete(c.id); }}>Apagar</Button>
          </div>
        </Card>
      ))}
      <ConfirmDialog
        open={!!target}
        title={`Apagar ${target?.name}?`}
        text="O cliente será removido da lista. Isso não pode ser desfeito."
        onCancel={() => setAskDelete(null)}
        onConfirm={() => { if (askDelete) setBlocked(deleteClient(db, askDelete) ?? ""); setAskDelete(null); }}
      />
    </Screen>
  );
}
