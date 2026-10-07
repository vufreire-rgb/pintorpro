// Gera COLAR_NO_PAINEL.ts: o mesmo código num arquivo só, para colar no editor de Edge Functions do painel do Supabase.
// Uso: node supabase/functions/voice-quote/gerar-arquivo-unico.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function compose(logic, index) {
  const importLine = index.split("\n").find((l) => l.startsWith("import {") && l.includes('"./logic.ts"'));
  const lines = index.replace(importLine + "\n", "").split("\n");
  const at = lines.findIndex((l) => l.startsWith("import { createClient }")) + 1;
  const body = logic.replace(/^export /gm, "");
  return [...lines.slice(0, at), "", "// ---- logic.ts (junto aqui para colar no painel) ----", body.trimEnd(), "// ---- fim de logic.ts ----", ...lines.slice(at)].join("\n");
}

const dir = fileURLToPath(new URL(".", import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(dir + "COLAR_NO_PAINEL.ts", compose(readFileSync(dir + "logic.ts", "utf8"), readFileSync(dir + "index.ts", "utf8")));
  console.log("COLAR_NO_PAINEL.ts gerado");
}
