"use client";
import { useEffect, useState } from "react";
import { initAuth, login, register, useAuthState, useSyncStatus } from "@/modules/auth";
import { Button, Field, Loading, TextInput } from "./ui";

function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg("");
    const err = mode === "in" ? await login(email, password) : await register(email, password);
    setBusy(false);
    if (err === "CONFIRM") setMsg("Enviamos um e-mail para confirmar sua conta. Abra o e-mail, toque no link e depois volte aqui para entrar.");
    else if (err) setMsg(err);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Pintor Pro</h1>
      <p className="text-lg text-slate-600">{mode === "in" ? "Entre na sua conta" : "Crie sua conta — 30 dias grátis"}</p>
      <Field label="E-mail"><TextInput type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Senha" hint={mode === "up" ? "Mínimo 6 caracteres." : undefined}>
        <TextInput type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {msg ? <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{msg}</p> : null}
      <Button disabled={busy || !email.includes("@") || password.length < 6} onClick={submit}>{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</Button>
      <Button variant="ghost" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>{mode === "in" ? "Não tenho conta — criar" : "Já tenho conta — entrar"}</Button>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  const sync = useSyncStatus();
  useEffect(() => initAuth(), []);
  if (auth.status === "loading") return <Loading />;
  if (auth.status === "signedOut") return <LoginScreen />;
  return (
    <>
      {sync === "error" ? (
        <div className="bg-amber-100 p-2 text-center text-sm text-amber-900">Sem conexão: salvo só neste aparelho. Vamos tentar de novo.</div>
      ) : null}
      {children}
    </>
  );
}
