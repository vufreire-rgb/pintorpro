# Medde

SaaS mobile-first de orçamentos para pintores. Especificação: `docs/Pintor_Pro_Documento_Mestre_v1.0.pdf`.
Plano, arquitetura, decisões, pendências e changelog: `docs/PLANO_TECNICO.md`.

## Desenvolvimento

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Camadas (impostas por lint): `app/components` → `modules` → `engine` (puro) → `repositories` → `integrations`.
