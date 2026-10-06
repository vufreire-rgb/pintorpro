"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Card, Field, TextInput } from "./ui";
import { confirmsDeletion, DELETE_WORD, deleteMyAccount } from "@/modules/account";

/** Exclusão da conta dentro do app (exigida pela Apple e pelo Google). Pede a palavra EXCLUIR para evitar toque sem querer. */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!open) return <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>Excluir minha conta</Button>;

  const run = async () => {
    setBusy(true);
    setError(false);
    const r = await deleteMyAccount();
    if (r === "error") {
      setBusy(false);
      setError(true);
    }
    // Se deu certo, o login volta sozinho (a conta acabou).
  };

  return (
    <Card className="flex flex-col gap-3 border-red-300 bg-red-50">
      <h3 className="text-lg font-bold">Excluir minha conta</h3>
      <p className="text-base">Isso apaga <b>para sempre</b> a sua conta e tudo o que está nela: clientes, visitas, orçamentos, obras, pagamentos, fotos e áudios. <b>Não dá para desfazer.</b></p>
      <p className="text-base">Se quiser guardar algum orçamento, envie o PDF antes.</p>
      <Field label={`Para confirmar, digite ${DELETE_WORD}`}>
        <TextInput value={typed} autoCapitalize="characters" onChange={(e) => setTyped(e.target.value)} />
      </Field>
      {error ? <p className="text-base font-semibold text-err">Não consegui excluir agora. Confira a internet e tente de novo. Nada foi apagado.</p> : null}
      <Button variant="danger-solid" icon={Trash2} disabled={!confirmsDeletion(typed) || busy} onClick={run}>{busy ? "Excluindo…" : "Excluir para sempre"}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setTyped(""); setError(false); }}>Cancelar</Button>
    </Card>
  );
}
