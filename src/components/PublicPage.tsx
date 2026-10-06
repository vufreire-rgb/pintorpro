import { APP_NAME } from "@/shared/brand";

/** Página pública (sem login) para textos legais exigidos pelas lojas. O texto final virá do titular. */
export function PublicPage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-6">
      <p className="text-base text-support">{APP_NAME}</p>
      <h1 className="font-display text-[28px] font-bold leading-9">{title}</h1>
      {children ?? <p className="text-lg">Texto em preparação.</p>}
    </main>
  );
}
