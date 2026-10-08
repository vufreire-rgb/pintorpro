"use client";
import { useState } from "react";
import { Copy, Share2, Check, Globe, Inbox, Power } from "lucide-react";
import { Button, Chip, Field, LinkButton, Section, TextArea, TextInput } from "./ui";
import { activatePage, deactivatePage, isValidSlug, pageErrorText, pageUrl, slugify, useMyPage } from "@/modules/publicPage";
import type { Db } from "@/modules/types";

/** Ajustes: liga a página pública onde o cliente pede orçamento sozinho. Só com conta (nuvem). */
export function PublicPageCard({ db }: { db: Db }) {
  const { page, loaded, reload } = useMyPage();
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [showServices, setShowServices] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const slug = slugEdit ?? page?.slug ?? slugify(db.company?.name ?? "");
  const on = !!page?.enabled;
  const url = pageUrl(slug);
  const validSlug = isValidSlug(slug);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await activatePage(db, { slug, headline, about, showServices });
      reload();
      setMsg(on ? "Página atualizada." : "Página ativada. Já pode divulgar o link.");
    } catch (e) {
      setMsg(pageErrorText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };
  const off = async () => {
    setBusy(true);
    setMsg("");
    try { await deactivatePage(); reload(); setMsg("Página desativada. O link parou de funcionar."); } catch (e) { setMsg(pageErrorText(e instanceof Error ? e.message : "")); } finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem permissão: o endereço está visível para copiar à mão */ } };
  const share = async () => {
    const text = `Peça seu orçamento de pintura com ${db.company?.name}: ${url}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Section title="Página para receber pedidos" hint={on ? "Seu link para clientes pedirem" : "Link para clientes pedirem orçamento"} icon={Globe} badge={on ? { text: "Ativa", ok: true } : undefined}>
      <p className="text-base text-support">Você ganha um link (por exemplo no Instagram ou no WhatsApp). O cliente preenche nome, WhatsApp e o que precisa, e o pedido aparece aqui no app, em <b>Orçamentos → Pedidos de clientes</b>.</p>
      <Field label="Endereço da sua página" hint={validSlug ? url : "Use de 3 a 40 letras minúsculas, números e hífen."}>
        <TextInput aria-label="Endereço da sua página" value={slug} onChange={(e) => setSlugEdit(slugify(e.target.value))} disabled={!loaded} />
      </Field>
      <Field label="Frase de apresentação (opcional)"><TextInput value={headline} placeholder="Ex.: Pintura residencial com capricho" onChange={(e) => setHeadline(e.target.value)} /></Field>
      <Field label="Sobre você (opcional)"><TextArea value={about} placeholder="Ex.: 10 anos de experiência. Atendo São Paulo e região." onChange={(e) => setAbout(e.target.value)} /></Field>
      <div className="flex items-center justify-between gap-3"><span>Mostrar os serviços que você faz</span><Chip active={showServices} onClick={() => setShowServices(!showServices)}>{showServices ? "Sim" : "Não"}</Chip></div>
      <Button icon={Check} disabled={busy || !loaded || !validSlug} onClick={() => void save()}>{busy ? "Salvando…" : on ? "Atualizar página" : "Ativar página"}</Button>
      {on ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" icon={Copy} onClick={() => void copy()}>{copied ? "Copiado!" : "Copiar link"}</Button>
            <Button variant="ghost" icon={Share2} onClick={() => void share()}>Divulgar</Button>
          </div>
          <LinkButton href="/pedidos" variant="ghost" size="sm" icon={Inbox}>Ver pedidos recebidos</LinkButton>
          <Button variant="danger" size="sm" icon={Power} disabled={busy} onClick={() => void off()}>Desativar página</Button>
        </div>
      ) : null}
      {msg ? <p role="status" className="text-base text-support">{msg}</p> : null}
      <p className="text-base text-support">Quem abre o link vê só o que está aqui: nome do negócio, cidade, WhatsApp e o texto que você escrever. Os dados de quem pede ficam só com você e entram na política de privacidade.</p>
    </Section>
  );
}
