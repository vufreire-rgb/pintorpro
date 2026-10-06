import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Page() {
  return <PublicPage title="Termos de uso" />;
}
