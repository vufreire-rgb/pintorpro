"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { loadPublicPage, REQUEST_ERRORS, sendRequest, type PageSnapshot } from "@/modules/publicPage";
import { tintOf } from "@/modules/pdfData";
import { APP_NAME } from "@/shared/brand";

/** Só mostra imagem JPEG em data URL (é só isso que o servidor deixa passar). */
const safeImg = (v?: string): string | undefined => (typeof v === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v) ? v : undefined);

type State = { name: "loading" } | { name: "ok"; p: PageSnapshot } | { name: "gone" } | { name: "offline" };

const inputCls = "min-h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-lg outline-none focus:border-[var(--brand)]";

/** Página pública do pintor: o cliente conhece o trabalho e pede um orçamento, sem instalar nada e sem login. */
export default function PaginaDoPintor() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<State>({ name: "loading" });
  const [f, setF] = useState({ name: "", phone: "", address: "", message: "", hp: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  useEffect(() => {
    let alive = true;
    loadPublicPage(slug)
      .then((p) => alive && setState({ name: "ok", p }))
      .catch((e: Error) => alive && setState(e.message === "not_found" ? { name: "gone" } : { name: "offline" }));
    return () => { alive = false; };
  }, [slug]);

  if (state.name === "loading") return <main className="grid min-h-dvh place-items-center text-lg text-support">Carregando…</main>;
  if (state.name !== "ok") {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div><h1 className="font-display text-2xl font-semibold">{state.name === "gone" ? "Página não encontrada" : "Não consegui abrir agora"}</h1><p className="mt-2 text-lg text-support">{state.name === "gone" ? "Este endereço não existe ou foi desativado." : "Verifique sua internet e tente de novo em instantes."}</p></div>
      </main>
    );
  }
  const p = state.p;
  const brand = p.color;
  const wa = p.whatsapp.replace(/\D/g, "");
  const photos = (p.photos ?? []).map(safeImg).filter((x): x is string => !!x);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await sendRequest(slug, f);
      setDone(true);
    } catch (err) {
      setError(REQUEST_ERRORS[(err as Error).message] ?? REQUEST_ERRORS.network!);
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-white p-4 pb-10" style={{ ["--brand" as string]: brand }}>
      <header className="flex items-center gap-3">
        {safeImg(p.avatar) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeImg(p.avatar)} alt={`Foto de ${p.company}`} className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: brand }} aria-hidden>{p.initials}</div>}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-7">{p.company}</h1>
          {p.city ? <div className="text-base text-support">{p.city}</div> : null}
        </div>
      </header>

      <section className="rounded-2xl p-4" style={{ background: tintOf(brand) }}>
        <p className="font-display text-xl font-semibold leading-6">{p.headline || "Peça seu orçamento de pintura"}</p>
        {p.about ? <p className="mt-2 whitespace-pre-wrap text-lg leading-6">{p.about}</p> : null}
      </section>

      {photos.length ? (
        <section>
          <b className="font-display text-lg">Trabalhos feitos</b>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {photos.map((src, i) => (
              <li key={i} className="aspect-square overflow-hidden rounded-xl bg-slate-200">
                <button type="button" onClick={() => setZoom(src)} aria-label={`Ampliar foto ${i + 1} de ${photos.length}`} className="block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Trabalho de ${p.company} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.services.length ? (
        <section>
          <b className="font-display text-lg">O que eu faço</b>
          <div className="mt-2 flex flex-wrap gap-2">{p.services.map((s) => <span key={s} className="rounded-full border border-line px-3 py-1.5 text-base">{s}</span>)}</div>
        </section>
      ) : null}

      {done ? (
        <section role="status" className="rounded-2xl border-2 p-4 text-center" style={{ borderColor: brand }}>
          <h2 className="font-display text-xl font-semibold">Pedido enviado!</h2>
          <p className="mt-1 text-lg">{p.company} vai entrar em contato pelo WhatsApp que você informou.</p>
        </section>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
          <h2 className="font-display text-xl font-semibold">Peça um orçamento</h2>
          <label className="flex flex-col gap-1 text-lg font-semibold">Seu nome<input required minLength={2} maxLength={80} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
          <label className="flex flex-col gap-1 text-lg font-semibold">Seu WhatsApp (com DDD)<input required type="tel" inputMode="tel" maxLength={20} placeholder="(11) 99999-9999" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
          <label className="flex flex-col gap-1 text-lg font-semibold">Endereço ou bairro da obra<input maxLength={200} className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" /></label>
          <label className="flex flex-col gap-1 text-lg font-semibold">O que você precisa pintar?<textarea maxLength={1000} rows={4} className={`${inputCls} py-3`} placeholder="Ex.: sala e dois quartos, paredes com mofo…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
          {/* Campo escondido: só robô preenche. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Não preencha<input tabIndex={-1} autoComplete="off" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} /></label></div>
          {error ? <p role="alert" className="text-base text-red-700">{error}</p> : null}
          <button type="submit" disabled={sending} className="min-h-16 rounded-2xl px-4 font-display text-xl font-semibold text-white disabled:opacity-60" style={{ background: brand }}>{sending ? "Enviando…" : "Enviar pedido"}</button>
          <p className="text-base text-support">Seus dados (nome, WhatsApp, endereço e o que você escreveu) serão enviados a {p.company} só para ele retornar o contato. <a href="/privacidade" className="underline">Política de privacidade</a>.</p>
        </form>
      )}

      {wa ? (
        <a href={`https://wa.me/55${wa.replace(/^55/, "")}?text=${encodeURIComponent("Olá! Vi sua página e gostaria de um orçamento.")}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#0A8545] px-4 font-display text-xl font-semibold text-white"><MessageCircle size={24} aria-hidden />Prefiro chamar no WhatsApp</a>
      ) : null}

      {zoom ? (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Foto do trabalho ampliada" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Fechar foto" onClick={() => setZoom(null)} className="absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink"><X size={24} aria-hidden /></button>
        </div>
      ) : null}

      <footer className="pt-2 text-center text-base text-support">Página feita com <a href="https://medde.com.br" className="font-semibold underline">{APP_NAME}</a></footer>
    </main>
  );
}
