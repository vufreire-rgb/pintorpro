"use client";
import { useRouter } from "next/navigation";
import { startQuickVisit } from "@/modules/quickVisit";
import { Button } from "./ui";

/** "GRAVAR VISITA": um toque e a visita já existe (o cliente é preenchido depois). */
export function QuickVisitButton({ label = "GRAVAR VISITA", variant }: { label?: string; variant?: "primary" | "ghost" }) {
  const router = useRouter();
  return <Button variant={variant} onClick={() => router.push(startQuickVisit())}>{label}</Button>;
}
