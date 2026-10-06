import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Excluir conta" };

export default function Page() {
  return <PublicPage title="Excluir conta" />;
}
