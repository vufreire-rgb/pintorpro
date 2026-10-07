"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Field, TextInput } from "@/components/ui";
import { PublicPage } from "@/components/PublicPage";
import { recoveryLink, setNewPassword, useAuthState } from "@/modules/auth";

/**
 * Destino do link de "esqueci a senha". O e-mail traz a pessoa já com uma sessão de recuperação;
 * aqui ela escolhe a senha nova. Sem o link (ou com link vencido) mostramos como pedir outro.
 */
export default function RedefinirSenha() {
  const router = useRouter();
  const auth = useAuthState();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

  // O servidor não conhece o link (ele vem no endereço do navegador): evita diferença na primeira pintura.
  const link = useSyncExternalStore(() => () => undefined, () => recoveryLink, () => null);
  const ready = auth.status === "ready" && link !== "expired";
  const mismatch = again.length > 0 && password !== again;

  const save = async () => {
    setBusy(true);
    setMsg("");
    const err = await setNewPassword(password);
    setBusy(false);
    if (err) setMsg(err);
    else router.replace("/visitas");
  };

  if (!ready) {
    const gone = link === "expired" || waited;
    return (
      <PublicPage title="Nova senha">
        {gone ? (
          <>
            <p className="text-lg">Este link venceu ou já foi usado. Peça um novo na tela de entrada, em <b>Esqueci minha senha</b>.</p>
            <Button onClick={() => router.replace("/")}>Voltar para entrar</Button>
          </>
        ) : <p className="text-lg">Conferindo seu link…</p>}
      </PublicPage>
    );
  }

  return (
    <PublicPage title="Nova senha">
      <p className="text-lg">Escolha uma senha nova para a sua conta.</p>
      <Field label="Nova senha" hint="Mínimo 6 caracteres.">
        <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Repita a nova senha">
        <TextInput type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      {mismatch ? <p className="text-base text-err">As senhas não são iguais.</p> : null}
      {msg ? <p className="rounded-xl bg-amber-50 p-3 text-[#8A4B00]">{msg}</p> : null}
      <Button disabled={busy || password.length < 6 || password !== again} onClick={save}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
    </PublicPage>
  );
}
