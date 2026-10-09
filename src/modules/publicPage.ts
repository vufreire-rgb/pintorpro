import { useEffect, useState } from "react";
import { deleteRequestRow, disablePublicPage, fetchPublicPage, getMyPage, listRequests, publishPublicPage, setRequestStatus, submitPublicRequest, type PageRow, type RequestRow } from "@/repositories/cloudStore";
import { cloudEnabled } from "./auth";
import { initialsOf } from "./pdfData";
import { updateDb, uid } from "./db";
import { addClient } from "./clients";
import type { Db } from "./types";

export type { RequestRow } from "@/repositories/cloudStore";

/** O que o cliente vê na página do pintor. Espelha supabase/functions/public-page/logic.ts. */
export interface PageSnapshot {
  v: 1;
  color: string;
  company: string;
  initials: string;
  city: string;
  whatsapp: string;
  headline: string;
  about: string;
  services: string[];
  avatar?: string;
  photos?: string[];
}

/** "Silva Pinturas & Cia!" -> "silva-pinturas-cia" (mesma regra do servidor). */
export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}
export const RESERVED_SLUGS = ["o", "p", "api", "admin", "app", "login", "medde", "pedidos", "orcamentos", "obras", "visitas", "clientes", "configuracoes", "onboarding", "privacidade", "termos", "excluir-conta", "redefinir-senha", "suporte", "ajuda", "www"];
export const isValidSlug = (v: string): boolean => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v) && !v.includes("--") && !RESERVED_SLUGS.includes(v);

export interface PageForm { slug: string; headline: string; about: string; avatar?: string; photos: string[] }

export function buildPageSnapshot(db: Db, f: PageForm): PageSnapshot {
  const c = db.company!;
  return {
    v: 1,
    color: c.brandColor ?? "#0F3B7A",
    company: c.name,
    initials: initialsOf(c.name),
    city: c.city,
    whatsapp: c.whatsapp,
    headline: f.headline.trim(),
    about: f.about.trim(),
    services: [],
    ...(f.avatar ? { avatar: f.avatar } : {}),
    ...(f.photos.length ? { photos: f.photos.slice(0, 6) } : {}),
  };
}

/** Endereço público oficial. Em testes locais usa o endereço aberto; em produção sempre o domínio do Medde (curto e bonito para compartilhar). */
export const PUBLIC_ORIGIN = "https://medde.com.br";
export const pageUrl = (slug: string): string => {
  const local = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return `${local ? window.location.origin : PUBLIC_ORIGIN}/p/${slug}`;
};

const PAGE_ERRORS: Record<string, string> = {
  slug_taken: "Este endereço já está em uso. Escolha outro (por exemplo, com o nome da cidade).",
  bad_slug: "Endereço inválido. Use de 3 a 40 letras minúsculas, números e hífen.",
  bad_snapshot: "Preencha o nome do negócio em Ajustes antes de ativar a página.",
  network: "Sem internet. Tente de novo quando estiver online.",
  failed: "Não consegui salvar agora. Se você colocou muitas fotos, tire uma e tente de novo.",
};
export const pageErrorText = (code: string): string => PAGE_ERRORS[code] ?? "Não consegui salvar agora. Tente de novo.";

export const activatePage = (db: Db, f: PageForm): Promise<void> => publishPublicPage(f.slug, buildPageSnapshot(db, f));
export const deactivatePage = (): Promise<void> => disablePublicPage();

/** Cliente: página publicada. */
export const loadPublicPage = async (slug: string): Promise<PageSnapshot> => (await fetchPublicPage(slug)) as PageSnapshot;

export const REQUEST_ERRORS: Record<string, string> = {
  bad_request: "Confira o nome e o WhatsApp (com DDD) e tente de novo.",
  busy: "O pintor recebeu muitos pedidos hoje. Tente amanhã ou chame direto no WhatsApp.",
  not_found: "Esta página não está mais disponível.",
  network: "Sem internet. Tente de novo em instantes.",
};
export const sendRequest = submitPublicRequest;

/** Pintor: situação da página dele e pedidos recebidos. Atualiza ao abrir e ao voltar para o app. */
export function useMyPage(): { page: PageRow | null; loaded: boolean; reload: () => void } {
  const [page, setPage] = useState<PageRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    getMyPage().then((p) => { if (alive) { setPage(p); setLoaded(true); } }).catch(() => undefined);
    return () => { alive = false; };
  }, [tick]);
  return { page, loaded, reload: () => setTick((t) => t + 1) };
}

export function useRequests(): { requests: RequestRow[]; loaded: boolean; reload: () => void } {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    listRequests().then((r) => { if (alive) { setRequests(r); setLoaded(true); } }).catch(() => undefined);
    return () => { alive = false; };
  }, [tick]);
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return { requests, loaded, reload: () => setTick((t) => t + 1) };
}

export const markRequest = setRequestStatus;
export const removeRequest = deleteRequestRow;

/** "(11) 98888-7777" para mostrar. */
export function phoneLabel(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : digits;
}

/** Link do WhatsApp para falar com quem pediu. */
export function requestWhatsApp(r: Pick<RequestRow, "name" | "phone">, company: string): string {
  const d = r.phone.replace(/\D/g, "");
  const first = r.name.trim().split(/\s+/)[0] ?? "";
  const text = `Olá${first ? `, ${first}` : ""}! Aqui é da ${company}. Recebi seu pedido de orçamento. Quando podemos combinar uma visita?`;
  return `https://wa.me/${d.length <= 11 ? "55" + d : d}?text=${encodeURIComponent(text)}`;
}

/** Cria o cliente e uma visita já iniciada com o pedido (endereço e o que o cliente escreveu). Devolve o id da visita. */
export function visitFromRequest(db: Db, r: Pick<RequestRow, "name" | "phone" | "address" | "message">): string {
  const existing = db.clients.find((c) => c.phone.replace(/\D/g, "") === r.phone.replace(/\D/g, "") && c.name.trim().toLowerCase() === r.name.trim().toLowerCase());
  const client = existing ?? addClient({ name: r.name.trim(), phone: phoneLabel(r.phone), address: r.address.trim() });
  const id = uid();
  const now = new Date().toISOString();
  updateDb((d) => ({ ...d, visits: [{ id, clientId: client.id, siteAddress: r.address.trim() || client.address, notes: r.message.trim() ? `Pedido do cliente: ${r.message.trim()}` : "", photoIds: [], createdAt: now, startedAt: now }, ...d.visits] }));
  return id;
}
