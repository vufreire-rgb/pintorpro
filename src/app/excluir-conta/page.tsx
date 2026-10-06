import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Excluir conta" };

/** Rascunho dos passos reais do app. O texto jurídico final (prazos, contato) virá do titular. */
export default function Page() {
  return (
    <PublicPage title="Excluir conta">
      <p className="text-lg">Você pode excluir sua conta do Medde e todos os dados dela direto no aplicativo:</p>
      <ol className="list-decimal pl-6 text-lg">
        <li>Abra o Medde e entre na sua conta.</li>
        <li>Toque em <b>Ajustes</b> (menu de baixo) e role até <b>Conta</b>.</li>
        <li>Toque em <b>Excluir minha conta</b>, digite <b>EXCLUIR</b> e confirme.</li>
      </ol>
      <p className="text-lg">São apagados: sua conta, clientes, visitas, orçamentos, obras, pagamentos, fotos e áudios. Não é possível desfazer.</p>
      <p className="text-base text-support">Texto em preparação: forma de contato para quem não consegue entrar no aplicativo.</p>
    </PublicPage>
  );
}
