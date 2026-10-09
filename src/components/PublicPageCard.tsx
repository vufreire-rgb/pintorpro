"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Share2, Check, Globe, Inbox, Power, ImagePlus, X, QrCode, Download } from "lucide-react";
import { Button, Field, LinkButton, Section, TextArea, TextInput } from "./ui";
import { activatePage, deactivatePage, isValidSlug, pageErrorText, pageUrl, slugify, useMyPage } from "@/modules/publicPage";
import { toAvatar, toWorkPhoto } from "@/modules/publicImages";
import { pageQrPoster } from "@/modules/pageQr";
import { qrDataUrl } from "@/modules/qr";
import { initialsOf } from "@/modules/pdfData";
import type { Db } from "@/modules/types";

const MAX_PHOTOS = 6;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Ajustes: liga a página pública onde o cliente pede orçamento sozinho. Só com conta (nuvem). */
export function PublicPageCard({ db }: { db: Db }) {
  const { page, loaded, reload } = useMyPage();
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const seeded = useRef(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const photosInput = useRef<HTMLInputElement>(null);

  // Ao abrir, mostra o que já está publicado (para "Atualizar" não apagar o que a pessoa escreveu antes).
  useEffect(() => {
    const snap = page?.snapshot;
    if (seeded.current || !snap) return;
    seeded.current = true;
    setHeadline(typeof snap.headline === "string" ? snap.headline : "");
    setAbout(typeof snap.about === "string" ? snap.about : "");
    setAvatar(typeof snap.avatar === "string" ? snap.avatar : undefined);
    setPhotos(strings(snap.photos));
  }, [page]);

  const slug = slugEdit ?? page?.slug ?? slugify(db.company?.name ?? "");
  const on = !!page?.enabled;
  const url = pageUrl(slug);
  const shortUrl = url.replace(/^https?:\/\//, "");
  const validSlug = isValidSlug(slug);
  const company = db.company?.name ?? "Meu negócio";

  useEffect(() => {
    if (!on || !validSlug) return;
    let alive = true;
    qrDataUrl(url, 320).then((d) => { if (alive) setQr(d); }).catch(() => undefined);
    return () => { alive = false; };
  }, [on, validSlug, url]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await activatePage(db, { slug, headline, about, avatar, photos });
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
    const text = `Olá! Aqui é ${company}. Peça seu orçamento de pintura por este link: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: company, text }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const pickAvatar = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setMsg("");
    try { setAvatar(await toAvatar(f)); } catch { setMsg("Não consegui ler essa foto. Tente outra (JPG ou PNG)."); }
  };
  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg("");
    const room = MAX_PHOTOS - photos.length;
    const next: string[] = [];
    let failed = 0;
    for (const f of Array.from(files).slice(0, room)) {
      try { next.push(await toWorkPhoto(f)); } catch { failed += 1; }
    }
    if (next.length) setPhotos((p) => [...p, ...next]);
    if (files.length > room) setMsg(`Cabem só ${MAX_PHOTOS} fotos. As que passaram do limite não entraram.`);
    else if (failed) setMsg(failed === 1 ? "Uma foto não pôde ser lida e ficou de fora." : `${failed} fotos não puderam ser lidas e ficaram de fora.`);
  };

  const poster = async (): Promise<Blob | null> => {
    try { return await pageQrPoster({ company, url, color: db.company?.brandColor ?? "#0F3B7A" }); } catch { setMsg("Não consegui montar a imagem agora. Tente de novo."); return null; }
  };
  const downloadQr = async () => {
    const blob = await poster();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${slug}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const shareQr = async () => {
    const blob = await poster();
    if (!blob) return;
    const file = new File([blob], `qr-${slug}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: company, text: url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    await downloadQr();
  };

  return (
    <Section title="Página para receber pedidos" hint={on ? "Seu link para clientes pedirem" : "Link para clientes pedirem orçamento"} icon={Globe} badge={on ? { text: "Ativa", ok: true } : undefined}>
      <p className="text-base text-support">Você ganha um link e um QR code (para o Instagram, o WhatsApp ou o cartão). O cliente vê seu trabalho, preenche nome, WhatsApp e o que precisa, e o pedido aparece aqui no app, em <b>Orçamentos → Pedidos de clientes</b>.</p>

      <Field label="Endereço da sua página" hint={validSlug ? shortUrl : "Use de 3 a 40 letras minúsculas, números e hífen."}>
        <TextInput aria-label="Endereço da sua página" value={slug} onChange={(e) => setSlugEdit(slugify(e.target.value))} disabled={!loaded} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="font-semibold">Sua foto</span>
        <div className="flex items-center gap-3">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-2xl font-bold text-white">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Sua foto de perfil" className="h-full w-full object-cover" />
            ) : initialsOf(company)}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button variant="ghost" size="sm" icon={ImagePlus} className="!w-auto" onClick={() => avatarInput.current?.click()}>{avatar ? "Trocar foto" : "Escolher foto"}</Button>
            {avatar ? <button type="button" className="min-h-12 font-display font-semibold text-err" onClick={() => setAvatar(undefined)}>Remover foto</button> : null}
          </div>
        </div>
        <input ref={avatarInput} type="file" accept="image/*" className="hidden" aria-label="Escolher foto de perfil" onChange={(e) => { void pickAvatar(e.target.files); e.target.value = ""; }} />
      </div>

      <Field label="Frase de apresentação (opcional)"><TextInput value={headline} placeholder="Ex.: Pintura residencial com capricho" onChange={(e) => setHeadline(e.target.value)} /></Field>
      <Field label="Sobre você (opcional)"><TextArea value={about} placeholder="Ex.: 10 anos de experiência. Atendo São Paulo e região." onChange={(e) => setAbout(e.target.value)} /></Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">Fotos dos seus trabalhos</span><span className="text-base text-support">{photos.length} de {MAX_PHOTOS}</span></div>
        {photos.length ? (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <li key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" aria-label={`Remover foto ${i + 1}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-0 top-0 grid h-12 w-12 place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white"><X size={18} aria-hidden /></span></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-base text-support">Mostre obras que você já fez. Quem vê a página confia mais.</p>}
        {photos.length < MAX_PHOTOS ? <Button variant="ghost" size="sm" icon={ImagePlus} onClick={() => photosInput.current?.click()}>Adicionar fotos</Button> : null}
        <input ref={photosInput} type="file" accept="image/*" multiple className="hidden" aria-label="Adicionar fotos dos trabalhos" onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ""; }} />
      </div>

      <Button icon={Check} disabled={busy || !loaded || !validSlug} onClick={() => void save()}>{busy ? "Salvando…" : on ? "Atualizar página" : "Ativar página"}</Button>

      {on ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-brand-soft px-4 py-3">
            <span className="min-w-0 break-all font-display text-lg font-semibold text-brand">{shortUrl}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" icon={Copy} onClick={() => void copy()}>{copied ? "Copiado!" : "Copiar link"}</Button>
            <Button variant="ghost" icon={Share2} onClick={() => void share()}>Divulgar</Button>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line p-4">
            <b className="inline-flex items-center gap-2 font-display text-lg"><QrCode size={20} aria-hidden />QR code da sua página</b>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code que abre ${shortUrl}`} className="h-44 w-44" />
            ) : <div className="h-44 w-44 rounded-xl bg-slate-100" />}
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="ghost" icon={Share2} onClick={() => void shareQr()}>Enviar QR</Button>
              <Button variant="ghost" icon={Download} onClick={() => void downloadQr()}>Baixar para imprimir</Button>
            </div>
            <p className="text-center text-base text-support">A imagem sai com seu nome e o link, pronta para imprimir em cartão, adesivo ou cartaz.</p>
          </div>
          <LinkButton href="/pedidos" variant="ghost" size="sm" icon={Inbox}>Ver pedidos recebidos</LinkButton>
          <Button variant="danger" size="sm" icon={Power} disabled={busy} onClick={() => void off()}>Desativar página</Button>
        </div>
      ) : null}
      {msg ? <p role="status" className="text-base text-support">{msg}</p> : null}
      <p className="text-base text-support">Quem abre o link vê só o que está aqui: nome do negócio, cidade, WhatsApp, suas fotos e o texto que você escrever. Os dados de quem pede ficam só com você e entram na política de privacidade.</p>
    </Section>
  );
}
