"use client";
import { useRouter } from "next/navigation";
import { startQuickVisit } from "@/modules/quickVisit";
import { Button } from "./ui";

/** "GRAVAR VISITA": um toque e a visita já existe (o cliente é preenchido depois). */
export function QuickVisitButton({ label = "Gravar visita", variant, className }: { label?: string; variant?: "primary" | "ghost"; className?: string }) {
  const router = useRouter();
  return <Button variant={variant} className={className} onClick={() => router.push(startQuickVisit())}>{label}</Button>;
}
