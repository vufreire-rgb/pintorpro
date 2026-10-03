"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/ui";

/** O app abre direto em Visitas (não há mais aba Painel). */
export default function Inicio() {
  const router = useRouter();
  useEffect(() => router.replace("/visitas"), [router]);
  return <Loading />;
}
