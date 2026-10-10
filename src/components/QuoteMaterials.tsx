"use client";
import { MessageCircle, Package, Share2 } from "lucide-react";
import { useState } from "react";
import { BlocoRecolhivel, Button, buttonCls, Chip } from "./ui";
import { DictationField } from "./DictationField";
import { organizeMaterials } from "@/modules/dictation";
import { materialsForShopping, materialsMessage } from "@/modules/materials";
import { setQuoteMaterials } from "@/modules/quotes";
import { waUrl } from "@/modules/visitList";
import { plural } from "@/shared/format";
import type { Client, Db, Quote } from "@/modules/types";

/** Tela do orçamento: lista de materiais da obra (escrita ou ditada), com envio à loja de tintas ou ao cliente. */
export function QuoteMaterials({ db, q, client }: { db: Db; q: Quote; client?: Client }) {
  const [text, setText] = useState(q.materialsText ?? "");
  const [show, setShow] = useState(q.showMaterials ?? false);
  const [saved, setSaved] = useState(false);
  const dirty = text !== (q.materialsText ?? "") || show !== (q.showMaterials ?? false);
  const { written, calculated } = materialsForShopping({ materialsText: text, result: q.result });
  const msg = materialsMessage({ company: db.company?.name ?? "", clientName: client?.name ?? "", address: q.siteAddress, written, calculated });
  const total = written.length + calculated.length;

  const save = () => { setQuoteMaterials(q.id, text, show); setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const toStore = async () => {
    if (!msg) return;
    if (navigator.share) { try { await navigator.share({ text: msg, title: "Lista de materiais" }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <BlocoRecolhivel title="Materiais da obra" icon={Package} summary={total ? plural(total, "item", "itens") : "Anote o que vai comprar"}>
      <DictationField label="Lista de materiais" hint="Um item por linha. Ao ditar, a lista já sai organizada." value={text} onChange={setText} organize={organizeMaterials} placeholder={"Ex.:\n2 latas de tinta acrílica 18 L\n1 massa corrida 25 kg"} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-base">Mostrar no PDF e no link do cliente</span>
        <Chip active={show} onClick={() => setShow(!show)}>{show ? "Sim" : "Não"}</Chip>
      </div>
      {dirty ? <Button onClick={save}>Salvar lista</Button> : saved ? <p role="status" className="text-base font-bold text-accent-dark">Lista salva.</p> : null}
      {calculated.length ? (
        <div className="text-base text-support">
          <b className="text-ink">Quantidades calculadas</b>
          <ul className="list-disc pl-5">{calculated.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      ) : null}
      {msg && !dirty ? (
        <div className="grid grid-cols-1 gap-2">
          <Button variant="ghost" icon={Share2} onClick={() => void toStore()}>Enviar para a loja de tintas</Button>
          {client?.phone ? <a href={waUrl(client.phone, msg)} target="_blank" rel="noreferrer" className={buttonCls("ghost")}><MessageCircle size={22} aria-hidden />Enviar ao cliente</a> : null}
        </div>
      ) : msg ? <p className="text-base text-support">Salve a lista para poder enviar.</p> : null}
    </BlocoRecolhivel>
  );
}
