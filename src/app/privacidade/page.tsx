import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Page() {
  return <PublicPage title="Política de privacidade" />;
}
