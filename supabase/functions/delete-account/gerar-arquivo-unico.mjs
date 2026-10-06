// Gera COLAR_NO_PAINEL.ts: o mesmo código num arquivo só, para colar no editor de Edge Functions do painel do Supabase.
// Uso: node supabase/functions/delete-account/gerar-arquivo-unico.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function compose(logic, index) {
  const importLogic = 'import { deleteAccount } from "./logic.ts";\n';
  const lines = index.replace(importLogic, "").split("\n");
  const at = lines.findIndex((l) => l.startsWith("import { createClient }")) + 1;
  const body = logic.replace(/^export /gm, "");
  return [...lines.slice(0, at), "", "// ---- logic.ts (junto aqui para colar no painel) ----", body.trimEnd(), "// ---- fim de logic.ts ----", ...lines.slice(at)].join("\n");
}

const dir = fileURLToPath(new URL(".", import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = compose(readFileSync(dir + "logic.ts", "utf8"), readFileSync(dir + "index.ts", "utf8"));
  writeFileSync(dir + "COLAR_NO_PAINEL.ts", out);
  console.log("COLAR_NO_PAINEL.ts gerado");
}
