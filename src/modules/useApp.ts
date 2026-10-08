"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateDbIfChanged, useDb } from "./db";
import { applyAutoStatus } from "./autoStatus";
import type { Db } from "./types";

/** Retorna o banco quando a conta já foi configurada; senão manda para o onboarding. */
export function useAppDb(): Db | null {
  const db = useDb();
  const router = useRouter();
  const needsOnboarding = db !== null && db.company === null;
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);
  const ready = !!db && db.company !== null;
  // Regras automáticas (orçamento sem resposta, situação da obra); só grava quando algo muda.
  useEffect(() => {
    if (ready) updateDbIfChanged((d) => applyAutoStatus(d));
  }, [ready, db]);
  return db && db.company ? db : null;
}
