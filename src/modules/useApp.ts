"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDb } from "./db";
import type { Db } from "./types";

/** Retorna o banco quando a conta já foi configurada; senão manda para o onboarding. */
export function useAppDb(): Db | null {
  const db = useDb();
  const router = useRouter();
  const needsOnboarding = db !== null && db.company === null;
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);
  return db && db.company ? db : null;
}
