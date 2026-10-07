"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { takeAccountDeletedNotice } from "@/modules/account";
import { forgotPassword, initAuth, login, register, resendConfirmationEmail, retryLoad, useAuthState, useSyncStatus } from "@/modules/auth";
import { APP_NAME, APP_TAGLINE } from "@/shared/brand";
import { BillingBanner } from "./BillingBanner";
import { BlockedScreen } from "./BlockedScreen";
import { Splash } from "./Splash";
import { BILLING_ENFORCED, useSubscription } from "@/modules/subscription";
import { Button, Field, Loading, TextInput } from "./ui";

function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted] = useState(takeAccountDeletedNotice);

  const go = (m: "in" | "up" | "reset") => { setMode(m); setMsg(""); setInfo(""); setNeedsConfirm(false); };

  const submit = async () => {
    setBusy(true);
    setMsg("");
    setInfo("");
    setNeedsConfirm(false);
    if (mode === "reset") {
      const err = await forgotPassword(email);
      if (err) setMsg(err);
      else setInfo("Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha. Abra o e-mail (veja também o spam) e toque no link.");
      setBusy(false);
      return;
    }
    const err = mode === "in" ? await login(email, password) : await register(email, password);
    setBusy(false);
    if (err === "CONFIRM" || err === "NOT_CONFIRMED") {
      setNeedsConfirm(true);
      setInfo("Enviamos um e-mail para confirmar sua conta. Abra o e-mail, toque no link e depois volte aqui para entrar.");
      if (err === "NOT_CONFIRMED") setInfo("Falta confirmar seu e-mail. Abra o e-mail que enviamos, toque no link e volte aqui para entrar.");
    } else if (err) setMsg(err);
  };

  const resend = async () => {
    setBusy(true);
    const err = await resendConfirmationEmail(email);
    setBusy(false);
    if (err) setMsg(err);
    else setInfo("Enviamos o e-mail de novo. Veja também a caixa de spam.");
  };

  const title = mode === "in" ? "Entrar na sua conta" : mode === "up" ? "Criar sua conta" : "Esqueci minha senha";
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand">
      <header className="flex flex-col items-center gap-3 px-6 pb-10 pt-14 text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/simbolo-sobre-escuro.svg" alt="" className="h-24 w-24" />
        <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-lg text-white/80">{APP_TAGLINE}</p>
      </header>
      <section className="flex flex-1 flex-col gap-4 rounded-t-3xl bg-white p-6 pb-10">
        <h2 className="text-2xl font-bold">{title}</h2>
        {mode === "up" ? <p className="-mt-2 text-support">Beta gratuito.</p> : null}
        {mode === "reset" ? <p className="-mt-2 text-support">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p> : null}
        <Field label="E-mail"><TextInput type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode !== "reset" ? (
          <Field label="Senha" hint={mode === "up" ? "Mínimo 6 caracteres." : undefined}>
            <TextInput type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        ) : null}
        {deleted && !msg && !info ? <p className="rounded-xl bg-brand-soft p-3 text-base">Sua conta foi excluída. Todos os seus dados foram apagados.</p> : null}
        {info ? <p className="rounded-xl bg-brand-soft p-3 text-base">{info}</p> : null}
        {msg ? <p className="rounded-xl bg-amber-50 p-3 text-[#8A4B00]">{msg}</p> : null}
        <Button disabled={busy || !email.includes("@") || (mode !== "reset" && password.length < 6)} onClick={submit}>
          {busy ? "Aguarde…" : mode === "in" ? "Entrar" : mode === "up" ? "Criar conta" : "Enviar link"}
        </Button>
        {needsConfirm ? <Button variant="ghost" disabled={busy || !email.includes("@")} onClick={resend}>Reenviar e-mail de confirmação</Button> : null}
        {mode === "in" ? <Button variant="ghost" onClick={() => go("reset")}>Esqueci minha senha</Button> : null}
        {mode === "reset" ? <Button variant="ghost" onClick={() => go("in")}>Voltar para entrar</Button> : (
          <Button variant="ghost" onClick={() => go(mode === "in" ? "up" : "in")}>{mode === "in" ? "Não tenho conta — criar" : "Já tenho conta — entrar"}</Button>
        )}
      </section>
    </div>
  );
}

/** Páginas abertas a qualquer pessoa, sem login (exigidas pelas lojas de aplicativos). */
const PUBLIC_PATHS = ["/privacidade", "/termos", "/excluir-conta", "/redefinir-senha"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuthState();
  const sync = useSyncStatus();
  const subs = useSubscription();
  useEffect(() => initAuth(), []);
  if (PUBLIC_PATHS.includes(pathname.replace(/\/$/, ""))) return <>{children}</>;
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
  if (BILLING_ENFORCED && subs.access?.level === "blocked") return <BlockedScreen />;
  return (
    <>
      <Splash />
      {sync === "error" ? (
        <div className="bg-amber-100 p-2 text-center text-base text-[#8A4B00]">Sem conexão: salvo só neste aparelho. Vamos tentar de novo.</div>
      ) : null}
      <BillingBanner />
      {children}
    </>
  );
}
