"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { loadSharedQuote, type SharedQuote } from "@/modules/quoteLinks";
import { qrDataUrl } from "@/modules/qr";
import { tintOf } from "@/modules/pdfData";
import { APP_NAME } from "@/shared/brand";

type State = { name: "loading" } | { name: "ok"; q: SharedQuote } | { name: "gone" } | { name: "offline" };

/** Página pública do orçamento (o cliente abre pelo link, sem login). */
export default function Orcamento() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ name: "loading" });
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    loadSharedQuote(token)
      .then((q) => alive && setState({ name: "ok", q }))
      .catch((e: Error) => alive && setState(e.message === "not_found" ? { name: "gone" } : { name: "offline" }));
    return () => { alive = false; };
  }, [token]);

  const code = state.name === "ok" ? state.q.pix?.code : undefined;
  useEffect(() => {
    if (!code) return;
    let alive = true;
    qrDataUrl(code, 280).then((u) => alive && setQr(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [code]);

  if (state.name === "loading") return <main className="grid min-h-dvh place-items-center text-lg text-support">Carregando orçamento…</main>;
  if (state.name === "gone") return <Notice title="Orçamento não encontrado" text="Este link não existe mais ou foi cancelado. Peça um novo link ao pintor." />;
  if (state.name === "offline") return <Notice title="Não consegui abrir agora" text="Verifique sua internet e tente de novo em instantes." />;

  const q = state.q;
  const brand = q.color;
  const expired = !!q.validUntil && Date.parse(q.validUntil) < now;
  const wa = q.painter.whatsapp.replace(/\D/g, "");
  const copy = async () => {
    try { await navigator.clipboard.writeText(q.pix!.code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem permissão: o código fica visível para copiar à mão */ }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-white p-4 pb-10" style={{ ["--brand" as string]: brand }}>
      <header className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white" style={{ background: brand }} aria-hidden>{q.painter.initials}</div>
        <div className="min-w-0">
          <div className="font-display text-xl font-bold leading-6">{q.painter.company}</div>
          {q.painter.contact ? <div className="text-base text-support">{q.painter.contact}</div> : null}
        </div>
      </header>

      {expired ? <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-base text-amber-900">Este orçamento venceu ({q.validity}). Fale com o pintor para confirmar valores e prazos.</p> : null}

      <section className="rounded-2xl p-4" style={{ background: tintOf(brand) }}>
        <div className="text-base text-support">Orçamento nº {q.number} · {q.date}</div>
        <div className="mt-1 text-lg font-semibold">{q.clientName}</div>
        {q.siteAddress ? <div className="text-base text-support">{q.siteAddress}</div> : null}
        {q.summary ? <p className="mt-3 text-lg leading-6">{q.summary}</p> : null}
        <div className="mt-3 text-base text-support">Valor total</div>
        <div className="font-display text-[40px] font-extrabold leading-[44px]" style={{ color: brand }} data-testid="total">{q.total}</div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        {[["Prazo", q.days], ["Pagamento", q.payment], ["Validade", q.validity]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 p-2">
            <div className="text-base text-support">{label}</div>
            <div className="text-base font-semibold leading-5">{value}</div>
          </div>
        ))}
      </section>

      {q.rooms.map((r, i) => (
        <section key={i} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-baseline justify-between gap-2"><b className="font-display text-lg">{r.name}</b>{q.showRoomPrices && r.price ? <b>{r.price}</b> : null}</div>
          {r.facts ? <div className="text-base text-support">{r.facts}</div> : null}
          <ul className="mt-2 list-disc pl-5 text-base leading-6">{r.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
          {r.materials ? <p className="mt-2 text-base text-support"><b>Materiais:</b> {r.materials}</p> : null}
        </section>
      ))}

      {q.notes ? <section className="rounded-2xl border border-slate-200 p-4"><b className="font-display text-lg">Observações</b><p className="mt-1 whitespace-pre-wrap text-base">{q.notes}</p></section> : null}

      {q.pix ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 p-4 text-center">
          <b className="font-display text-lg">Pagar a entrada por Pix</b>
          <div className="text-base text-support">{q.pix.amount} · {q.pix.pct}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="QR Code do Pix" className="h-52 w-52" /> : null}
          <button onClick={copy} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 font-display text-lg font-bold" style={{ borderColor: brand, color: brand }}><Copy size={20} aria-hidden />{copied ? "Código copiado!" : "Copiar código Pix"}</button>
          {q.pix.receiver ? <div className="text-base text-support">Recebedor: {q.pix.receiver}</div> : null}
        </section>
      ) : null}
      {q.deposit ? (
        <a href={q.deposit.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center rounded-2xl px-4 font-display text-lg font-bold text-white" style={{ background: brand }}>Pagar a entrada ({q.deposit.amount})</a>
      ) : null}

      {q.terms.exclusions.length || q.terms.before.length || q.terms.warranty ? (
        <details className="rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-display text-lg font-bold">Combinados e garantia</summary>
          {q.terms.exclusions.length ? <><b className="mt-3 block">Não está incluso</b><ul className="list-disc pl-5 text-base">{q.terms.exclusions.map((t, i) => <li key={i}>{t}</li>)}</ul></> : null}
          {q.terms.before.length ? <><b className="mt-3 block">Antes de começar</b><ul className="list-disc pl-5 text-base">{q.terms.before.map((t, i) => <li key={i}>{t}</li>)}</ul></> : null}
          {q.terms.warranty ? <><b className="mt-3 block">Garantia</b><p className="text-base">{q.terms.warranty}</p></> : null}
        </details>
      ) : null}

      {wa ? (
        <a href={`https://wa.me/55${wa.replace(/^55/, "")}?text=${encodeURIComponent(`Olá! Vi o orçamento nº ${q.number}.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#0A8545] px-4 font-display text-xl font-bold text-white"><MessageCircle size={24} aria-hidden />Falar com {q.painter.company.split(" ")[0]}</a>
      ) : null}

      <footer className="pt-2 text-center text-base text-support">
        Orçamento feito com <a href="https://medde.com.br" className="font-semibold underline">{APP_NAME}</a>
      </footer>
    </main>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
      <div><h1 className="font-display text-2xl font-bold">{title}</h1><p className="mt-2 text-lg text-support">{text}</p></div>
    </main>
  );
}
