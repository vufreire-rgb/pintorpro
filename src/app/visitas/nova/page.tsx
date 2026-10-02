"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Loading } from "@/components/ui";
import { startQuickVisit } from "@/modules/quickVisit";
import { useAppDb } from "@/modules/useApp";

/** Endereço antigo: cria a visita na hora e abre a tela dela (sem deixar esta página no histórico). */
export default function NovaVisita() {
  const db = useAppDb();
  const router = useRouter();
  const done = useRef(false);
  const ready = db !== null;
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    router.replace(startQuickVisit());
  }, [ready, router]);
  return <Loading />;
}
