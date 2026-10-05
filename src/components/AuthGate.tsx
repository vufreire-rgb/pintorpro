"use client";
import { useEffect, useState } from "react";
import { initAuth, login, register, retryLoad, useAuthState, useSyncStatus } from "@/modules/auth";
import { APP_NAME, APP_TAGLINE } from "@/shared/brand";
import { ThemeApplier } from "./ThemeApplier";
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand">
      <header className="flex flex-col items-center gap-3 px-6 pb-10 pt-14 text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/simbolo-sobre-escuro.svg" alt="" className="h-24 w-24" />
        <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-lg text-white/80">{APP_TAGLINE}</p>
      </header>
      <section className="flex flex-1 flex-col gap-4 rounded-t-3xl bg-white p-6 pb-10">
        <h2 className="text-2xl font-bold">{mode === "in" ? "Entrar na sua conta" : "Criar sua conta"}</h2>
        {mode === "up" ? <p className="-mt-2 text-support">30 dias grátis, sem cartão.</p> : null}
        <Field label="E-mail"><TextInput type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha" hint={mode === "up" ? "Mínimo 6 caracteres." : undefined}>
          <TextInput type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {msg ? <p className="rounded-xl bg-amber-50 p-3 text-[#8A4B00]">{msg}</p> : null}
        <Button disabled={busy || !email.includes("@") || password.length < 6} onClick={submit}>{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</Button>
        <Button variant="ghost" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>{mode === "in" ? "Não tenho conta — criar" : "Já tenho conta — entrar"}</Button>
      </section>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  const sync = useSyncStatus();
  useEffect(() => initAuth(), []);
  if (auth.status === "loading") return <Loading />;
  if (auth.status === "signedOut") return <LoginScreen />;
  if (auth.status === "error")
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Não conseguimos carregar seus dados</h1>
        <p className="text-lg text-support">Verifique sua internet e tente de novo. Seus dados continuam guardados na sua conta, nada foi apagado.</p>
        <Button onClick={retryLoad}>Tentar de novo</Button>
      </div>
    );
  return (
    <>
      <ThemeApplier />
      {sync === "error" ? (
        <div className="bg-amber-100 p-2 text-center text-base text-[#8A4B00]">Sem conexão: salvo só neste aparelho. Vamos tentar de novo.</div>
      ) : null}
      {children}
    </>
  );
}
