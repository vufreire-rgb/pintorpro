# Pintor Pro — Plano Técnico do MVP

> Fonte de verdade funcional: `docs/Pintor_Pro_Documento_Mestre_v1.0.pdf`.
> Este arquivo é o documento vivo do projeto (arquitetura, decisões, banco, regras, pendências, changelog).
> Última atualização: 2026-09-30 · Fase atual: **0 — Planejamento**

---

## 1. Interpretação do produto

Pintor Pro é um **motor de orçamento + CRM mínimo + gestão de obra + financeiro essencial**, mobile-first, para pintores autônomos e pequenas equipes. A promessa é: *o pintor faz a visita, mede, e sai com um orçamento profissional no WhatsApp do cliente, sabendo quanto vai lucrar.*

Pontos que definem o produto:

- **Valor central = orçamento confiável na frente do cliente.** Todo o resto (CRM, obra, agenda, financeiro) existe para alimentar ou aproveitar esse orçamento.
- **Não é `m² × R$/m²`.** Cada superfície (parede, teto, porta, janela, grade, rodapé) tem estado atual e recebe uma *cadeia de serviços*; cada serviço tem sua própria unidade de cobrança (m², m linear, unidade, diária, preço fechado).
- **Dois "preços" convivem:** o que o cliente vê (PDF) e a visão interna (custo, lucro, margem) — esta nunca vai ao PDF.
- **Simplicidade radical:** usuário não técnico, uma decisão por tela, valores padrão inteligentes, tudo editável só quando necessário.
- **Dados como ativo:** o que é registrado desde a V1 (previsto vs. realizado, histórico de preços de material, produtividade) deve permitir inteligência e referências regionais anonimizadas na V2/V3.
- **Modelo comercial:** R$ 29,90/mês, +R$ 14,90 por colaborador com login, 30 dias grátis sem cartão, retenção de dados por 12 meses.

## 2. Escopo

### 2.1 Requisitos do MVP (conforme sua lista + Documento Mestre §5)

Núcleo (fases 1–6 abaixo) — os 20 itens da sua lista:

1. Cadastro/login · 2. Onboarding · 3. Configuração de serviços/preços · 4. Clientes · 5. Obra/orçamento · 6. Ambientes · 7. Superfícies · 8. Medições · 9. Portas/janelas · 10. Serviços por superfície · 11. Materiais · 12. Cálculo · 13. Custos · 14. Margem/lucro · 15. Revisão · 16. PDF · 17. WhatsApp · 18. Status Aberto/Fechado/Perdido · 19. Orçamento fechado → obra · 20. Dashboard básico.

**Incluídos no Documento Mestre §5 mas fora da sua lista de 20** (proponho tratá-los como "MVP fase 2", depois do núcleo estar validado): agenda básica, equipe, despesas extras, financeiro essencial (recebimentos/parcelas, visão mensal), assinatura e permissões (colaborador com login), lembretes. Ver decisão D-01.

### 2.2 Separação MVP × Futuro

| Categoria | Itens |
|---|---|
| **MVP-Núcleo** | Itens 1–20 acima; acréscimo/desconto; prazo com dias de segurança; validade fixa 7 dias |
| **MVP-Complemento** (após núcleo validado) | Equipe/funcionário sem login, agenda com aviso de conflito, despesas extras, recebimentos/parcelas, fluxo de caixa mensal, fotos por obra, assinatura/trial 30 dias, perfil colaborador com login, lembretes |
| **Estrutura prevista, sem implementação** | Tabelas de orçado × realizado (`work_time_entries`, `work_material_usage`), `region` nos dados, histórico de preços de material, versionamento de regras do motor, `tenant_id` em tudo |
| **Futuro (V2)** | Orçado×realizado com análises, produtividade por pessoa, portal do cliente, aprovação digital, indicação (1 mês grátis) |
| **Futuro (V3+)** | Preço recomendado regional, comparação de lojas, marketplace/comissões, NF-e, contratos automatizados, integração contábil, combustível automático, outras categorias (eletricista etc.) |

## 3. Ambiguidades e decisões pendentes

### 3.1 Decisões que alteram arquitetura/custo/segurança — **preciso da sua resposta**

| # | Pergunta | Minha recomendação |
|---|---|---|
| D-01 | **Escopo do MVP:** seguir sua lista de 20 itens primeiro e só depois agenda/financeiro/assinatura/equipe (que o PDF também põe no MVP)? | Sim: núcleo primeiro, complemento depois |
| D-02 | **Backend:** Supabase (Postgres + Auth + Storage + RLS, gerenciado) vs. backend próprio (Node + Postgres + auth própria). | Supabase — menor custo/operação para 1 fundador, Postgres puro (migração fácil), RLS dá isolamento por tenant |
| D-03 | **Formato do produto:** PWA (instalável, um código só) vs. app nativo (React Native/Expo). | PWA agora; motor em TS puro permite reaproveitar em Expo depois |
| D-04 | **Formação de preço** (ambiguidade real do PDF, ver 3.2-a). | Ver abaixo |
| D-05 | **Margem vs. markup** (o PDF pede validação). | Suportar os dois via configuração; **padrão: margem sobre a venda** (`preço = custo ÷ (1 − margem)`), mostrando sempre "lucro em R$". Você confirma? |
| D-06 | **Idioma/moeda/região:** só pt-BR e BRL no MVP? | Sim; strings e moeda já isoladas para i18n futuro |
| D-07 | **Cobrança/assinatura** (gateway: Asaas, Stripe, Pagar.me…) e política LGPD de dados agregados. | Adiar para a fase de assinatura; dados de trial/acesso modelados desde já |

### 3.2 Ambiguidades funcionais (resolvidas por configuração, sem inventar regra)

- **a) Preço-base × custo+margem.** Onboarding pede "preço-base dos serviços" (§6.4), mas §9 diz "preço = mão de obra + materiais + despesas + margem". Proposta: cada serviço tem **preço de venda por unidade** (o que o pintor cobra de mão de obra) *e* o motor calcula o **custo real** (horas × custo/hora + materiais + despesas). O orçamento mostra os dois lados: preço-base vendido, custo estimado, lucro e margem resultante; e um modo alternativo "cost-plus" (custo + margem desejada). O modo padrão é configurável por conta.
- **b) Produtividade por serviço** (m²/hora/pessoa): sem valor no PDF → campo configurável por serviço; *seed de demonstração marcado `is_demo`*; UI avisa "confirme sua produtividade" enquanto for demo.
- **c) Rendimento padrão de materiais**, **perdas** e **arredondamento por embalagem**: configuráveis por material (`yield`, `waste_pct`, `pack_size`, `rounding`); defaults = demo.
- **d) Proteção de vãos:** o PDF diz que vãos descontados ainda geram fita/proteção no perímetro. Regra parametrizada: `opening_perimeter_protection_enabled` + material vinculado.
- **e) Custo de equipe:** como ele calcula custo/hora? Proposta: custo/dia do profissional (informado no onboarding, "quanto você quer ganhar por dia") ÷ horas de jornada. Configurável por membro.
- **f) Dias de segurança:** valor manual por orçamento com padrão da conta (clima é V2+).
- **g) Cliente com múltiplas obras** e obra com múltiplos orçamentos (revisões): modelo suporta; UI do MVP mostra o caminho simples.
- **h) Editar orçamento após enviado:** proposta — cria nova versão (`revision`), a anterior fica registrada.
- **i) Trial expirado:** "fica sem acesso"; dados retidos 12 meses. Implementação na fase de assinatura.
- **j) Modo offline:** pintores trabalham em obras com sinal ruim. MVP: PWA com cache do app shell e *rascunho local* do orçamento; sync completo offline-first é futuro (evita complexidade prematura). Confirmar prioridade.

## 4. Arquitetura

### 4.1 Camadas (dependência só de cima para baixo)

```
┌──────────────────────────────────────────────────────────┐
│ UI (app/ + components/)    telas, formulários, estado    │  Next.js / React
├──────────────────────────────────────────────────────────┤
│ Casos de uso (modules/*/actions)  regras de negócio,     │  TS, sem React
│  validação (zod), orquestração, permissões               │
├──────────────────────────────────────────────────────────┤
│ Motor de orçamento (engine/)  PURO: sem I/O, sem React,  │  TS puro, 100% testável
│  sem banco, sem Date.now()                               │
├──────────────────────────────────────────────────────────┤
│ Dados (repositories/)  acesso ao Postgres, mapeamento    │  Supabase client
├──────────────────────────────────────────────────────────┤
│ Integrações (integrations/)  PDF, WhatsApp/Share, e-mail,│  adaptadores
│  pagamento (futuro), combustível (futuro)                │
└──────────────────────────────────────────────────────────┘
```

Regras impostas por lint (`eslint-plugin-boundaries` ou `no-restricted-imports`):
- `engine/` **não importa** nada fora de `engine/` e `shared/` (nem React, nem Supabase).
- Componentes de UI **não calculam nada**: chamam casos de uso / motor via hooks e só exibem o resultado.
- Somente `repositories/` conhece o banco; somente `integrations/` conhece serviços externos.

### 4.2 Estrutura de pastas

```
pintorpro/
├─ docs/                     # PDF mestre + este plano + ADRs
├─ supabase/migrations/      # SQL versionado (fonte da verdade do banco)
├─ src/
│  ├─ app/                   # rotas Next.js (mobile-first)
│  ├─ components/            # UI reutilizável (botões grandes, wizard, etc.)
│  ├─ modules/               # clients, quotes, catalog, works, onboarding...
│  │   └─ <mod>/{actions,schemas,queries}
│  ├─ engine/                # motor de orçamento (puro)
│  │   ├─ types.ts  pipeline.ts  money.ts  rounding.ts
│  │   ├─ steps/ (measure, quantify, materials, labor, costs, pricing, schedule)
│  │   ├─ rules/ (registro de regras e unidades de cobrança)
│  │   └─ __tests__/
│  ├─ repositories/          # acesso a dados
│  ├─ integrations/          # pdf/, share/whatsapp/, billing/(futuro)
│  └─ shared/                # config, i18n pt-BR, formatadores, tipos comuns
└─ tests/                    # e2e (Playwright)
```

### 4.3 Multi-tenancy e segurança

- Toda tabela de negócio tem `company_id`; **RLS** no Postgres garante isolamento (`company_id = auth.jwt().company_id`).
- Papéis: `owner`, `collaborator` (só obras alocadas), e `employee` (registro interno sem login, não é usuário).
- Preço/custo/lucro/margem: exibidos apenas ao `owner`; colaborador nunca recebe esses campos (views/colunas separadas + RLS).
- PDF gerado no servidor a partir de um *DTO do cliente* que **por construção não contém** custo/lucro/margem.
- Dados pessoais de clientes finais: LGPD — minimização, exclusão/retirada em 12 meses (fase de assinatura).
- Dados agregados futuros: derivados por job separado, sem `company_id`/cliente/endereço exato (só região + faixa), com consentimento (D-07).

## 5. Stack proposto

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Um idioma no motor, UI e backend |
| Web | **Next.js (App Router) + React** | PWA, SSR, rotas de API/PDF no mesmo repo |
| Estilo | **Tailwind CSS** (+ componentes próprios, sem UI kit pesado) | Botões grandes, leve, controle total |
| Backend/BD | **Supabase**: Postgres + Auth + Storage + RLS | Gerenciado, SQL padrão, migração fácil |
| Validação | **zod** | Schemas compartilhados UI/servidor |
| Dinheiro | **inteiros em centavos** (sem float) | Precisão; quantidades em `numeric` |
| PDF | **@react-pdf/renderer** no servidor (alternativa: HTML→PDF com Chromium) | Sem browser em produção, layout controlado |
| WhatsApp | **Web Share API (com arquivo)** + fallback `wa.me` com link do PDF | Segue o PDF §12; sem API paga |
| Testes | **Vitest** (motor, unit) + **Playwright** (fluxo e2e mobile) | Motor com cobertura alta |
| Migrações | SQL puro em `supabase/migrations` | Portável |
| Deploy | Vercel + Supabase (ou similar) | Custo baixo inicial |

Dependências mantidas mínimas; nada de state manager global no início (server state + React).

## 6. Modelo de dados (rascunho inicial)

Convenções: `id uuid`, `company_id` em toda tabela de negócio, `created_at/updated_at`, `deleted_at` (soft delete), dinheiro em `*_cents bigint`, quantidades `numeric(14,4)`.

### 6.1 Conta e configuração
| Tabela | Campos principais |
|---|---|
| `companies` | nome comercial, logo_url, whatsapp, cidade, cep, `region_code`, cpf_cnpj (opc), jornada_horas_dia, margem_padrão, `margin_mode`, `pricing_mode`, dias_segurança_padrão, payment_terms_default, `validity_days` (=7) |
| `profiles` | `user_id` (auth), `company_id`, nome, celular, `role` (owner/collaborator) |
| `subscriptions` | plano, `trial_ends_at`, status, `retention_until` (fase assinatura) |
| `referrals` | indicador, indicado, benefício (futuro) |

### 6.2 Catálogo (configurável — é aqui que vivem as "regras")
| Tabela | Campos principais |
|---|---|
| `service_types` | catálogo-base da plataforma (proteção, raspagem, massa corrida, pintura…): `code`, nome, `billing_unit` padrão, `quantity_basis` (ex.: `wall_area`, `ceiling_area`, `linear_perimeter`, `unit_count`, `fixed`) |
| `company_services` | serviço ativado pela empresa: `service_type_id`, `billing_unit` (m2/ml/un/diaria/fechado), `sale_price_cents`, `productivity` (unidades/hora/pessoa), `coats_default`, `is_demo` |
| `service_material_rules` | serviço → material: `consumption_basis`, usa rendimento e demãos |
| `materials` | nome, categoria, `unit`, `price_cents`, `yield_per_unit` (ex.: m²/L), `waste_pct`, `pack_size`, `is_demo` |
| `material_price_history` | material, preço, data, `region_code` (base p/ referências futuras) |
| `surface_types` / `surface_conditions` | parede/teto/porta/janela/grade/rodapé; nova/pintada/descascando/trincas… (com regras de serviço sugeridos por estado) |

### 6.3 Cliente e orçamento
| Tabela | Campos principais |
|---|---|
| `clients` | nome, telefone, endereço |
| `projects` (obra-lead) | cliente, endereço da obra, tipo (residência…) |
| `quotes` | projeto, `number`, `revision`, `status` (open/won/lost), `valid_until`, `subtotal`, `discount/surcharge`, `total_cents`, `estimated_cost_cents`, `estimated_profit_cents`, `estimated_days`, `safety_days`, `engine_version`, `config_snapshot jsonb`, `payment_terms` |
| `rooms` | quote, nome, dimensões (comp., larg., pé-direito) |
| `surfaces` | room, tipo, `condition_id`, medidas, `coats` |
| `openings` | surface/room, tipo (porta/janela), dimensões, quantidade, `deduct_from_area`, `protect_perimeter` |
| `quote_service_items` | surface, service, quantidade, `unit`, preço, custo, horas previstas |
| `quote_material_items` | material, quantidade prevista, `included` (cliente fornece?), custo, overrides de rendimento |
| `quote_extra_items` | item/despesa manual |

### 6.4 Obra, financeiro e realizado (complemento + estrutura futura)
| Tabela | Campos principais |
|---|---|
| `works` | `quote_id` (snapshot do orçado), status (agendada/em andamento/pendências/concluída), início/fim previstos, início/fim reais, progresso % |
| `work_members`, `team_members` | membros (com/sem login), custo/dia ou hora |
| `schedule_entries` | obra, membro, data |
| `work_expenses` | obra, categoria, valor, data |
| `receivables` | obra, parcela, vencimento, valor, status, data de recebimento |
| `work_photos` | obra, url, data, legenda |
| `work_time_entries` **(realizado)** | obra, serviço, membro, horas reais |
| `work_material_usage` **(realizado)** | obra, material, quantidade usada, custo real |

**Orçado × realizado:** cada linha `quote_*_items` tem seu par "real" ligado por `service_id`/`material_id` + `work_id`. Como a obra guarda o `quote_id` e o orçamento é imutável após fechado (snapshot), a comparação é uma consulta de junção — sem alterar o esquema depois.

### 6.5 Relacionamentos-chave
`companies 1─N clients 1─N projects 1─N quotes 1─N rooms 1─N surfaces 1─N (openings, quote_service_items)`; `quote_service_items N─1 company_services N─1 service_types`; `quote_material_items N─1 materials`; `quotes 1─0..1 works 1─N (expenses, receivables, photos, time_entries, material_usage)`.

## 7. Fluxo de telas

```
Login/Criar conta ─▶ Onboarding (1 pergunta/tela, ~11 passos)
   └▶ Painel  [ + NOVO ORÇAMENTO ]
        ├─ Clientes ─ Novo cliente
        ├─ Orçamentos (Abertos | Fechados | Perdidos)
        ├─ Obras ─ Detalhe da obra ─ (fotos, despesas, progresso)
        └─ Configurações (serviços/preços, materiais, custos)

Novo orçamento:
 1 Cliente/obra → 2 Ambientes → 3 Superfícies (tipo + estado atual)
 → 4 Medidas e vãos → 5 Serviços sugeridos por estado (marca/desmarca)
 → 6 Materiais (habilitar/desabilitar, editar rendimento)
 → 7 Custos, margem, desconto/acréscimo (interno)
 → 8 Revisão (resumo + lucro interno) → 9 PDF → 10 Compartilhar WhatsApp
 → marcar Aberto/Fechado/Perdido → (Fechado) informar pagamento ⇒ cria Obra
```

Princípios de UI: uma decisão por tela, barra de progresso, botões ≥ 48 px, teclado numérico para números, valores padrão pré-preenchidos, "voltar" sempre seguro, rascunho salvo automaticamente.

## 8. Motor de orçamento

**Objetivo:** função pura `calculateQuote(input, config) → result`. Determinística, sem I/O, sem dependência de relógio; mesmo input + mesma config = mesmo resultado (auditável e reproduzível).

### 8.1 Entrada e saída
- **Input:** cômodos → superfícies (dimensões, estado, demãos) → vãos → serviços selecionados; overrides do usuário (rendimento, quantidades, materiais habilitados); ajustes (desconto/acréscimo).
- **Config (snapshot):** serviços da empresa (unidade, preço, produtividade), materiais (preço, rendimento, perda, embalagem), custo/hora da equipe, jornada, dias de segurança, margem, `margin_mode`, `pricing_mode`, política de arredondamento.
- **Result:** linhas por serviço, materiais, custos, totais (preço, custo, lucro, margem), horas previstas, dias estimados, **avisos** (ex.: "produtividade é valor de demonstração") e trilha de cálculo por linha (`explain`) para depuração e futura comparação com o realizado.

### 8.2 Pipeline (cada etapa = função pura pequena)
1. **measure** — paredes = perímetro × altura; teto = comp. × larg.; vãos descontados; perímetro de vãos para proteção.
2. **quantify** — para cada `(superfície, serviço)` resolve a quantidade conforme `quantity_basis` e `billing_unit` (m², ml, un, diária, fechado).
3. **materials** — consumo = (área × demãos) ÷ rendimento, com perda (%) e arredondamento por embalagem, ambos configuráveis; respeita "material incluído/cliente fornece".
4. **labor** — horas = quantidade ÷ produtividade; custo = horas × custo/hora da equipe.
5. **costs** — soma materiais + mão de obra + despesas + itens manuais.
6. **pricing** — conforme `pricing_mode` (preço-base vs. cost-plus) e `margin_mode` (margem s/ venda vs. markup); aplica desconto/acréscimo; calcula lucro e margem.
7. **schedule** — dias = horas ÷ (jornada × equipe) arredondado por política + dias de segurança.

### 8.3 Extensibilidade (novos serviços/regras sem reescrever)
- **Serviço = dado, não código:** `quantity_basis` + `billing_unit` + regras de material referenciam *estratégias registradas* (`registry` de bases de quantidade e unidades). Novo serviço comum = nova linha em `service_types` / `company_services`; novo *tipo de cálculo* = registrar uma estratégia nova no `registry`, sem tocar no pipeline.
- **Versionamento:** `engine_version` + `config_snapshot` salvos no orçamento; mudar preços/regras depois **não altera** orçamentos antigos.
- **Dinheiro em centavos**, arredondamento centralizado em `money.ts`/`rounding.ts`.
- **Testes:** exemplos do PDF (100 m² × 2 demãos ÷ 10 m²/L = 20 L) como testes de ouro; testes de propriedade (soma das linhas = total; preço ≥ 0; idempotência).
- Valores de demonstração vêm de `seed` claramente rotulados (`is_demo = true`) e o resultado do motor emite aviso enquanto forem usados.

## 9. Plano de implementação por fases

Cada fase termina com algo **testável** (critério de aceite) e é validada com você antes de seguir.

| Fase | Entrega | Aceite |
|---|---|---|
| **0 — Fundação** | Repo Next.js+TS+Tailwind, lint de camadas, Vitest/Playwright, CI, supabase local, migração inicial, PWA shell, i18n pt-BR | `pnpm test` e build verdes; app abre no celular |
| **1 — Motor (isolado)** | `engine/` completo p/ medidas, quantidades, materiais, mão de obra, preço, prazo + testes de ouro; CLI/harness de simulação | Exemplos do PDF reproduzidos; cobertura alta; sem imports de UI/BD |
| **2 — Conta + Onboarding** | Auth, RLS, onboarding 1 pergunta/tela, catálogo demo | Conta nova → pronta para orçar em ~5 min |
| **3 — Cadastros** | Clientes, serviços/preços, materiais/rendimento, histórico de preço | CRUD mobile; isolamento por empresa testado |
| **4 — Wizard de orçamento** | Cliente/obra → ambientes → superfícies → medidas/vãos → serviços → materiais → custos/margem → revisão, com motor ligado; rascunho automático | Orçamento completo feito no celular sem ajuda |
| **5 — PDF + WhatsApp + CRM** | PDF (sem dados internos), share, status Aberto/Fechado/Perdido, validade 7 dias, lista de orçamentos | PDF correto; compartilha via WhatsApp; status muda |
| **6 — Fechado → Obra + Dashboard** | Conversão em obra (snapshot do orçado), painel básico | Fechar orçamento gera obra; painel mostra abertos/vendido |
| **7 — Complemento** | Equipe, agenda/conflitos, despesas, recebimentos/parcelas, financeiro mensal, fotos, lembretes | Fluxo obra→financeiro coerente |
| **8 — Assinatura e permissões** | Trial 30d, colaborador com login (RLS restrita), gateway | Acesso bloqueia/libera conforme plano |
| **9 — Endurecimento** | Testes com pintores reais, acessibilidade, performance, LGPD, revisão de regras "a validar" | Critério de sucesso do PDF §22 |

> O PDF §24 recomenda prototipar e validar com pintores reais antes de programar tudo. Sugestão: ao terminar a Fase 1 + esqueleto da Fase 4 (com dados demo), fazer uma sessão de teste com 2–3 pintores antes de aprofundar cadastros.

## 10. Status (IMPLEMENTADO / EM DESENVOLVIMENTO / PENDENTE / FUTURO)

| Status | Item |
|---|---|
| **IMPLEMENTADO** | Leitura do Documento Mestre; este plano técnico |
| **EM DESENVOLVIMENTO** | — (aguardando aprovação do plano e decisões D-01…D-07) |
| **PENDENTE** | Fases 0–9 acima; decisões D-01…D-07; validação de regras do PDF §23 |
| **FUTURO** | V2 (orçado×realizado analítico, portal do cliente, aprovação digital, indicação); V3 (preço regional, marketplace, NF-e, integrações); expansão a outras categorias |

## 11. Regras de negócio registradas (do PDF)

- Paredes = perímetro × altura · Teto = comp. × larg. · Vãos podem ser descontados, mas geram proteção de perímetro.
- Tinta (L) = (área × demãos) ÷ rendimento. Ex.: 100 m² × 2 ÷ 10 = 20 L.
- Preço = mão de obra + materiais habilitados + despesas + margem, com desconto/acréscimo final.
- Validade do orçamento: 7 dias (fixa na V1). Prazo = f(metragem, serviço, produtividade, jornada, equipe) + dias de segurança.
- Custo, lucro e margem **nunca** aparecem no PDF do cliente.
- CRM: Aberto → Fechado (vira obra automaticamente) | Perdido (arquivado, sem exigir motivo).
- Material pode ser desabilitado (cliente fornece). Rendimento sempre editável.
- **A validar (não inventar):** produtividade, rendimentos padrão, perdas/arredondamento, margem×markup, dias de segurança/clima, contrato, LGPD, cobrança.

## 12. Changelog

- 2026-09-30 — Documento Mestre v1.0 analisado; plano técnico criado (Fase 0 — Planejamento).
