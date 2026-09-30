import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteiras de camada (ver docs/PLANO_TECNICO.md §4.1).
const forbid = (patterns, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group: patterns, message }] }],
});

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    // O motor de orçamento é puro: sem UI, banco, integrações ou módulos de negócio.
    files: ["src/engine/**/*.ts"],
    rules: forbid(
      ["react", "react-dom", "next", "next/*", "@supabase/*", "@/app/*", "@/components/*", "@/modules/*", "@/repositories/*", "@/integrations/*"],
      "engine/ é puro: só pode importar de engine/ e shared/.",
    ),
  },
  {
    // A interface não calcula nem acessa dados: usa casos de uso.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: forbid(
      ["@/engine/*", "@/repositories/*", "@supabase/*"],
      "UI não importa motor nem dados diretamente: use src/modules/*.",
    ),
  },
];

export default eslintConfig;
