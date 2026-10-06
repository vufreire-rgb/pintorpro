# Pintor Pro — Plano Técnico do MVP

> Fonte de verdade funcional: `docs/Pintor_Pro_Documento_Mestre_v1.0.pdf`.
> Este arquivo é o documento vivo do projeto (arquitetura, decisões, banco, regras, pendências, changelog).
> Última atualização: 2026-09-30 · Fase atual: **MVP navegável (dados locais)**

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

### 3.1 Decisões que alteram arquitetura/custo/segurança — **APROVADAS em 2026-09-30 (seguir recomendações)**

D-01…D-07 aceitas conforme a coluna "Minha recomendação". Em D-04, o modo padrão de preço (preço-base × custo+margem) será fechado na Fase 1, ao implementar o motor; ambos ficam suportados por configuração.

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
| **IMPLEMENTADO** | Motor de orçamento puro + 11 testes (medidas, vãos, materiais, embalagem, rendimento editável, preço-base e custo+margem, margem × markup, desconto/acréscimo, prazo); onboarding de 10 telas; painel; clientes; assistente de orçamento (cliente → ambientes → serviços → materiais → preço → revisão); PDF sem dados internos; compartilhamento (Web Share / WhatsApp); status Aberto/Fechado/Perdido com validade de 7 dias; Fechado → Obra; lista/status de obras; configurações (serviços, preços, produtividade, materiais, rendimento, perdas); teste de fluxo completo `tests/smoke.mjs` |
| **EM DESENVOLVIMENTO** | — |
| **PENDENTE** | Validar fotos/áudios na nuvem em celular real; religar "Confirm email"; etapa B (tabelas relacionais); "esqueci a senha"; service worker/ícones PWA; agenda com conflitos; equipe; despesas e recebimentos/parcelas; fotos; lembretes; assinatura/trial; colaborador com login; validar regras do PDF §23 (valores atuais são de DEMONSTRAÇÃO) |
| **FUTURO** | V2 (orçado×realizado analítico, portal do cliente, aprovação digital, indicação); V3 (preço regional, marketplace, NF-e, integrações); outras categorias |

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
- 2026-09-30 — Decisões D-01…D-07 aprovadas. Fase 0: scaffold Next 16 / React 19 / Tailwind 4 / Vitest, ESLint com fronteiras de camada (engine puro, UI sem motor/dados), CI. Fixados TypeScript 5 e ESLint 9 por incompatibilidade de plugins com TS 7/ESLint 10.
- 2026-09-30 — MVP navegável: motor + testes, telas mobile, PDF, WhatsApp, CRM, obra, painel. Decisão de curto prazo (reversível): dados em `localStorage` via `src/repositories/localStore.ts` até existir projeto Supabase; trocar apenas esse arquivo + criar auth. Preço dos serviços NÃO é multiplicado por demãos (demãos afetam material e horas) — a confirmar.
- 2026-09-30 — Login + nuvem (etapa A): Supabase Auth (e-mail/senha), tabela `user_data` (um documento JSON por conta, com RLS), sincronização com cache local (`src/modules/sync.ts`), tela de login, botão Sair. Liga sozinho quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` existem; sem elas o app segue em modo local. **Decisão (reversível):** guardar como documento JSON agora e migrar para tabelas relacionais (etapa B) depois que as regras de cálculo forem fechadas, para não reescrever tabelas duas vezes. Limitações: última gravação vence (dois aparelhos editando ao mesmo tempo podem sobrescrever); sem "esqueci a senha" ainda; dados agregados/orçado×realizado dependem da etapa B. Código da nuvem NÃO testado contra um Supabase real (ainda sem chaves).
- 2026-10-01 — Pivô de fluxo (a validar com mais pintores): painel agora tem **GRAVAR VISITA** como ação principal. Nova tela Visitas (cliente → fotos + observações, salvamento automático) antes do orçamento; ao "Montar orçamento" o assistente abre já no passo de ambientes, com cliente/endereço preenchidos e as anotações/fotos da visita visíveis. "Orçar rápido" mantém o fluxo antigo. Fotos ficam no aparelho (IndexedDB, comprimidas a 1600 px); **não sincronizam com a nuvem** até ligarmos Supabase Storage. Áudio da visita: IMPLEMENTADO (ver abaixo). Teste de fluxo `tests/smoke.mjs` cobre visita + foto + orçamento.
- 2026-10-01 — Áudio na visita: botão Gravar/Parar (MediaRecorder; formato escolhido conforme o navegador), lista com player e apagar, ouvir também dentro do assistente de orçamento. Arquivos em IndexedDB (`src/repositories/fileStore.ts`, antes `photoStore`), **só no aparelho** (não sincroniza até o Supabase Storage). Aviso na tela para informar o cliente da gravação (LGPD). Sem transcrição (futuro). Testado com microfone simulado; **testar em celular real** (permissão de microfone e iPhone/Safari).
- 2026-10-01 — Supabase ligado (projeto criado, SQL aplicado, chaves na Vercel; login confirmado funcionando pelo usuário). Fotos e áudios agora sobem para o bucket privado `visit-files` (caminho `<userId>/<arquivoId>`), com fila de reenvio se faltar internet (`pintorpro:pending-uploads`) e download automático quando o arquivo não existe no aparelho (`src/modules/photos.ts`, `src/modules/session.ts`). Aceita `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Não testado contra o Supabase real pela sandbox (rede bloqueada); validar no celular.** Região do projeto: EUA/Ohio (não dá para mudar sem recriar). "Confirm email" está DESLIGADO para testes — religar antes de vender. Dados do orçamento ainda são um documento JSON por conta (etapa A).
- 2026-10-01 — Teste real (2 celulares, mesma conta): texto/orçamento sincronizaram; fotos/áudio mostraram "não está neste aparelho" porque a versão com Storage ainda não estava na `main`; e a segunda pessoa viu o cadastro inicial de novo (provável corrida/falha na carga inicial). **Correção de segurança de dados** (`src/modules/sync.ts`): (1) nunca enviar para a nuvem antes de ler a nuvem com sucesso; (2) aparelho sem cópia local + falha de leitura = tela "Não conseguimos carregar seus dados / Tentar de novo" em vez de conta vazia; (3) cargas simultâneas de login deduplicadas; (4) marcas `dirty`/`synced` por conta: edição offline é enviada se a nuvem não mudou, senão a nuvem manda e o local vira cópia de segurança (`pintorpro:v1:backup:*`); (5) tela de cadastro redireciona sozinha se os dados da conta chegarem enquanto ela está aberta. 6 testes automatizados cobrem esses cenários (`src/modules/sync.test.ts`). Causa raiz exata do cadastro repetido NÃO confirmada (sem acesso ao Supabase da sandbox) — pedir ao usuário para repetir o teste na nova versão.
- 2026-10-01 — Bug de compatibilidade de áudio: Android/Chrome gravava WebM (ou MP4 com Opus), que o iPhone não toca (player mudo, sem opção de baixar). Correção: preferir MP4/AAC; qualquer outro formato é convertido no próprio aparelho para WAV mono 16 kHz (`normalizeAudio` em `src/modules/audio.ts`); aviso se o aparelho não consegue tocar (botão Baixar foi removido a pedido do usuário). Teste `tests/audio-format.mjs` (força o caso WebM). **Áudios gravados antes desta correção continuam em WebM** e não tocam no iPhone (regravar). Validar em iPhone real.
- 2026-10-01 — Editar/duplicar/apagar. **Orçamento:** Editar (abre o assistente com os dados; não permitido se Fechado), Duplicar (novo número, Aberto, validade nova), Apagar (com confirmação; se Fechado apaga também a obra). Edição recalcula com os valores ATUAIS dos Ajustes, incrementa `revision`, renova `validUntil` (7 dias) e `revisedAt` (data do PDF); detalhe mostra "rev. N". **Visita:** Apagar (remove fotos/áudios no aparelho e na nuvem; orçamento já feito permanece). **Cliente:** Editar e Apagar (só se não tiver visita/orçamento). **Obra:** Apagar (orçamento permanece). Componente `ConfirmDialog`. 7 testes novos de regras (`src/modules/quotes.test.ts`) + fluxo completo no `tests/smoke.mjs`. Decisão a validar com pintores: histórico de revisões anteriores NÃO é guardado (só o contador).
- 2026-10-01 — App instalável (PWA): `src/app/manifest.ts` (standalone, retrato, cor do tema), ícones provisórios (rolo de pintura em azul; 192/512 + maskable + apple-icon 180) — **trocar pela identidade visual quando chegar**; service worker `public/sw.js` (arquivos versionados cache-first; páginas rede-primeiro com cópia local; fora do domínio, ex.: Supabase, sempre direto da rede; versão do cache `v1` — mudar para invalidar); `src/modules/pwa.ts` (registro do SW só em produção + captura de `beforeinstallprompt`); `InstallBanner` no painel (Android: botão Instalar; iPhone: passo a passo do Safari; "Agora não") e em Ajustes (sempre). Área segura do iPhone na barra inferior (`viewport-fit=cover`). Testes: `tests/pwa.mjs` + verificação manual com servidor desligado (painel, tela já visitada e aviso "Sem internet" para tela nova funcionam). **Limitações:** offline só abre telas já visitadas; criar/ler dados na nuvem e sincronizar precisam de internet (a fila de reenvio cobre fotos/áudio; edições seguem o fluxo de sincronização); iPhone só instala pelo Safari. Validar em celulares reais.
- 2026-10-02 — Identidade visual recebida (pacote "medde-logo": símbolo "d com régua", azul #0F3B7A, verde #14A85E). **Nome provisório "Medde" — o próprio pacote pede conferir no INPI antes de publicar; a busca web simples não achou nada, mas NÃO substitui a consulta no INPI.** Preparado (NÃO publicado): `src/shared/brand.ts` (APP_NAME/tagline/cores num lugar só), tema Tailwind `brand`/`accent`, ícones do app (192/512/maskable/apple 180) a partir do pacote, símbolo em `public/brand/`, tela de login redesenhada (topo azul com símbolo + folha branca), PDF e cores do app em azul da marca. Verde `#14A85E` tem contraste 3,1 com texto branco; botões usam `accent-dark #0B7F44` (5,1). **Não aplicado:** logotipo com a palavra escrita (falta o arquivo da fonte Outfit/convertido em curvas) e ícone Android adaptativo (só relevante para app de loja). Chaves internas de armazenamento continuam `pintorpro:*` de propósito (renomear apagaria os dados locais dos usuários). Aguardando confirmação do nome para publicar; no iPhone o ícone/nome ficam gravados na instalação, então trocar depois exige reinstalar.
- 2026-10-02 — **Publicado: só o visual novo (opção c).** Nome continua "Pintor Pro" (`APP_NAME` em `src/shared/brand.ts`). A versão instalável (PWA) foi DESLIGADA num commit próprio: removidos `src/app/manifest.ts`, `public/sw.js`, `public/icons/*`, o aviso `InstallBanner` no painel/Ajustes, o import de `@/modules/pwa` e `appleWebApp` no layout (os arquivos `src/modules/pwa.ts`, `src/components/InstallBanner.tsx` e `tests/pwa.mjs` continuam no repositório). **Para religar depois da consulta no INPI:** `git revert <commit "desliga PWA">` (traz de volta tudo), trocar `APP_NAME` para o nome final e rodar `node tests/pwa.mjs`. Visual publicado: azul/verde da marca, símbolo "d com régua" no login e favicon/ícone iOS.
- 2026-10-02 — **Novo PDF do orçamento (desenho do designer, etapa 1).** 3 seções (resumo; "O que será feito" por ambiente; "Combinados" + fotos), A4, fontes Outfit (títulos/valores) e Atkinson Hyperlegible (textos), licença OFL (licenças em `public/fonts/`; Outfit variável foi "congelada" em 700 e 800 porque o gerador de PDF não lê fonte variável). Referências do designer em `docs/design/`. Código: `src/modules/pdfData.ts` (puro/testável: resumo, fatos do ambiente, serviços em linguagem de cliente por `clientText`, materiais por ambiente, valor por ambiente via `allocate`, entrada, textos padrão) e `src/integrations/pdf/quotePdf.tsx` (desenho). **Novos campos:** Company (`ownerName`, `brandColor` — 6 cores —, `exclusionsText`, `beforeStartText`, `warrantyText`, `depositPct`), Quote (`showRoomPrices`, `paymentLink`, `depositPct`), Visit (`photoMeta`: fotos "No PDF" até 6, com ambiente e legenda), ServiceConfig (`clientText`). **Regras:** nunca mostra custo/lucro/margem (teste automático); botão "PAGAR ENTRADA" só aparece se o pintor colar um link de pagamento (não há integração de pagamento); valor por ambiente é rateio proporcional do total (soma fecha exato); tom claro dos blocos = 8% da cor + branco (bate com a ficha). **Decisões que usei por conta própria:** monograma com iniciais do nome da empresa (sem upload de logo); textos de "não incluso"/"antes de começar"/"garantia" são sugestões editáveis em Ajustes (revisão jurídica da garantia pendente); "dias úteis" = dias de trabalho + dias de segurança. **Não feito:** upload do logo do pintor; foto do PDF só vem da visita ligada ao orçamento. Testes: `src/modules/pdfData.test.ts` (8) e `tests/pdf-preview.mjs` (gera 2 PDFs reais pelo app; conferir com PyMuPDF). Também corrigido texto desatualizado "fica neste aparelho" nas telas de foto/áudio quando a conta está na nuvem.
- 2026-10-02 — **Visitas aprimoradas (7 melhorias).** (1) *Visita rápida*: GRAVAR VISITA cria a visita na hora, já iniciada e SEM cliente (`Visit.clientId` agora opcional); o cliente é escolhido/cadastrado na tela da visita ou no orçamento (ao salvar o orçamento a visita herda o cliente); `/visitas/nova` virou redirecionamento. (2) *Medidas rápidas*: `Visit.rooms` (nome, comp., larg., altura, estado da parede, portas, janelas) usam o mesmo formulário do orçamento (`RoomFormCard`, `src/modules/rooms.ts`) e viram os ambientes do orçamento com os serviços sugeridos. (3) *Câmera no app* (`CameraCapture`): várias fotos seguidas com o ambiente marcado na hora (grava em `photoMeta.room`) + galeria com seleção múltipla. (4) *Lista*: miniatura, busca sem acento (cliente, telefone, endereço, notas, ambientes), filtros Todas/Agendadas/Falta orçar/Orçadas com contagem, agendadas primeiro. (5) *Agendar visita* (`/visitas/agendar`): `scheduledAt`/`startedAt`; estados agendada/atrasada (passou >1h)/feita; botões Começar agora, Confirmar pelo WhatsApp (mensagem pronta), Adicionar à agenda (.ics com alarme 1h antes — é assim que há lembrete, sem notificação push), Reagendar; painel mostra "Próximas visitas". (6) *Atalhos*: Ligar, WhatsApp, Mapa. (7) *Marcas no áudio*: 📍 Medida, ⚠️ Problema, ⭐ Importante, 💬 Pedido do cliente (`AudioNote.markers`), tocar na marca pula para o momento; **antes da 1ª gravação de cada visita pede confirmação "Você avisou o cliente?"** (`recordingConsent`). Também: `Card` agora aceita trocar cor de fundo/borda (antes cartões "amarelo/azul" saíam brancos). Testes: 16 novos de regras (`src/modules/visits.test.ts`), `tests/visitas.mjs` (agendar/.ics/lista/painel/visita rápida) e `tests/smoke.mjs` atualizado (câmera, medidas, marcas, consentimento). **Riscos a validar em celular real:** no iPhone, abrir a câmera do app enquanto grava áudio pode interromper o áudio; a câmera do app usa resolução do vídeo (pode ser menor que a câmera nativa); .ics no iPhone abre o calendário só via Safari.

## Atualização: cor do app, "Salvar visita" e logo
- IMPLEMENTADO: a cor escolhida em Ajustes (`company.brandColor`) agora pinta o app todo (`ThemeApplier` + `src/modules/theme.ts`, variáveis `--color-brand*`); o verde de destaque continua fixo.
- IMPLEMENTADO: botão "✅ Salvar visita" na visita; sem cliente, pede nome (obrigatório) e telefone só nesse momento. A visita continua sendo guardada automaticamente (rascunho) para não perder foto/áudio.
- IMPLEMENTADO: upload do logo em Ajustes (PNG reduzido a 500 px, guardado como os outros arquivos, `company.logoId`); o PDF usa o logo no lugar das iniciais. PENDENTE: conferir visualmente o logo no PDF em aparelho real.
- IMPLEMENTADO: tela Visitas limpa: "GRAVAR VISITA" e "Agendar" menores lado a lado; sem busca/filtros; 3 abas (Agendadas, Sem orçamento, Orçamento feito) — abre em Agendadas e dá para deslizar para o lado. A busca por cliente saiu da tela (a função `filterVisits` ainda a suporta).
- IMPLEMENTADO: Obras com função. Lista com "falta receber" e barra de pagamento; tela da obra (`/obras/[id]`) com contato (ligar/WhatsApp/mapa), status, datas de início/término (sugere término pelos dias previstos) + arquivo de agenda (.ics, dia inteiro, lembrete na véspera), dinheiro da obra (combinado/recebido/falta, registrar entrada/parcela/final, entrada sugerida pela % do orçamento) e orçamento + visita de origem (observações, fotos, áudios). Painel ganhou "Obras desta semana" e "Falta receber das obras". Novos campos em Work: startDate, endDate, payments. PENDENTE: diário da obra (fotos antes/durante/depois), gastos reais (orçado × realizado).
- IMPLEMENTADO: "⏰ Hora de revisar" no topo de Orçamentos: o pintor escolhe hora e dias; o app gera um evento de calendário recorrente (.ics, RRULE + alarme na hora) que apita no celular com o app fechado. Guardado em `company.reviewReminder`. LIMITE: não é notificação do app (isso exige app instalado/PWA + servidor de push; ver PWA desligado) e, se mudar o horário, o pintor apaga o antigo no calendário. FUTURO: notificação push real quando o PWA voltar.
- IMPLEMENTADO: aba Orçamentos no mesmo layout de Visitas: "+ NOVO ORÇAMENTO" e "⏰ Lembrete" lado a lado, 3 abas (Aberto, Fechado, Perdido) com contagem e deslizar para o lado; o lembrete abre como cartão abaixo dos botões. Teste smoke atualizado para o fluxo "Salvar visita".
- FUTURO (ideia guardada): alarme de verdade do celular (app Relógio) e notificação própria do app para "Hora de revisar". Só é possível com o app instalado (PWA reativado/app de loja). Hoje o lembrete usa o calendário do celular.
- IMPLEMENTADO: aba Painel eliminada; o app abre direto em Visitas (`/` redireciona). Números do painel (vendido no mês, lucro estimado, falta receber, obras em andamento) agora ficam num botão recolhível "📊 Ver painel (valores)" na aba Obras, sempre escondido ao abrir (o cliente pode estar olhando). Removidos: taxa de fechamento, próximas obras, cards de visitas/obras no início. "Total em aberto" aparece na aba Aberto de Orçamentos. "Meus clientes" passou para Ajustes. NOTA: `tests/pwa.mjs` (PWA desligado) ainda assume o painel e precisará de ajuste quando o PWA voltar.
- IMPLEMENTADO: marcar a foto. Em cada foto da visita, botão ✏️ abre tela cheia com Texto, Seta e Cota (medida), 6 cores, mover, desfazer, apagar, zoom (botões e pinça) e "Enviar" (WhatsApp/baixar). As marcas ficam em `photoMeta[id].marks` (coordenadas 0–1, foto original intacta, sincroniza com a conta) e são desenhadas por `src/modules/markDraw.ts` (mesmo código na tela, na miniatura, no PDF e no envio). Aparecem nas miniaturas, na tela da obra e no PDF do cliente. Teste: `tests/marcar.mjs`. PENDENTE: validar toque/zoom com dedos em celular real (Android e iPhone); marcas no PDF ficam pequenas por serem fotos pequenas.
- IMPLEMENTADO: orçamento numa tela só (substitui as 6 etapas). Ordem: anotações da visita (recolhidas), cliente (da visita ou novo; nome e telefone só se faltar), ambientes já com os serviços sugeridos (chips para trocar; demãos/quantidades recolhidas), "⚙️ Ajustes do orçamento (opcional)" recolhido (materiais, desconto/acréscimo, pagamento, observações, opções do PDF), botão "Ver meu custo e lucro" (escondido por padrão) e barra fixa embaixo com o preço e "Salvar orçamento". Edição usa a mesma tela. Testes (smoke, pdf-preview) atualizados.
- CORRIGIDO: no orçamento de uma tela, o ambiente digitado (medidas válidas) já entra no preço e é salvo mesmo sem tocar em "+ Adicionar ambiente" (achado pelo teste do usuário no Android). Teste: `tests/orcamento.mjs`.
- IMPLEMENTADO: "📍 Usar minha localização" no endereço da visita. Pede a posição ao celular (só ao tocar), guarda o ponto (`visit.location`: lat, lng, precisão) e tenta preencher o endereço escrito pelo OpenStreetMap/Nominatim (grátis; uso moderado). O botão Mapa abre nas coordenadas exatas (visita e obra). Se o serviço de endereço falhar, o ponto fica salvo e o endereço digitado é preservado. Permissão negada mostra mensagem clara. Teste: `tests/localizacao.mjs` (Nominatim simulado). PENDENTE: validar em celular real (Android e iPhone, dentro de prédio); trocar Nominatim por Google/Mapbox quando houver muitos usuários (regras de uso do Nominatim: poucos pedidos por segundo); incluir menção à localização na política de privacidade.
- IMPLEMENTADO (rodada de UX): menu de baixo destaca a aba atual (`aria-current`, cor e traço); "Salvar visita" fixo na base da tela da visita e formulário de medidas recolhido atrás de um botão; Ajustes em blocos recolhíveis (`Section`): Seu negócio (aberto), PDF, Serviços e preços, Materiais e "Avançado: custos e lucro" (altura caiu de ~7.000 px para ~1.000 px); listas de visitas sem "0 foto(s)", com plural certo e sem data repetida em visitas agendadas; botão desligado mais legível. Teste: `tests/ux.mjs`.
- IMPLEMENTADO (financeiro, nível 1): (1) Plano de pagamento por obra (`Work.plan`): modelos À vista / Entrada + saldo / Entrada + 2 ou 3 parcelas, parcelas editáveis (data, valor), pagamentos cobrem as parcelas em ordem; estados Paga / Paga em parte / Vence em breve / Atrasada; aviso de atraso na obra, na lista de obras e no painel escondido. (2) Cobrança: botão "💬 Cobrar" abre o WhatsApp com mensagem educada pronta e o Pix copia e cola. (3) Recibo em PDF por pagamento (nº, valor por extenso, referente a, forma, saldo; "não substitui nota fiscal"), enviado pelo WhatsApp. (4) Pagamento com forma (Pix, dinheiro, cartão, transferência, outro) e foto do comprovante. (5) Pix copia e cola/QR estático (BR Code, CRC16) com a chave do próprio pintor (Ajustes → Receber por Pix): QR de R$ 1,00 para testar, QR por parcela, QR da entrada no PDF do orçamento e código copia e cola na mensagem do WhatsApp. O app NÃO recebe nem guarda dinheiro; o pintor marca "recebido". Código: `src/modules/{pix,finance,receiptData,qr}.ts`, `src/integrations/pdf/receiptPdf.tsx`. Testes: `finance.test.ts`, `tests/financeiro.mjs`. PENDENTE: conferir o Pix pagando R$ 1,00 de verdade em 2 bancos; nível 2 (gastos por obra, orçado × realizado); degrau 3 (subconta em gateway com baixa automática por webhook — exige backend e pagamentos em tabelas próprias); cobrança da assinatura (Stripe/Asaas) antes de vender; estudar regras Apple/Google para assinatura no app de loja.
- IMPLEMENTADO: cobrança em PDF por parcela (botão "📄 PDF": valor, vencimento, situação, QR do Pix, resumo da obra; sai pelo WhatsApp com a mensagem pronta e o Pix copia e cola) e "📤 Enviar comprovante" (manda a foto anexada ao pagamento). Quando o celular não abre o compartilhamento direto, o arquivo é baixado e um aviso explica como anexar no WhatsApp. Código: `chargeData.ts`, `chargePdf.tsx`, `share.ts` (shareCharge, shareProof).
- IMPLEMENTADO (ajustes do designer, itens 1–7 da lista de 05/10): (1) fontes no app: Outfit (títulos, preços, botões) e Atkinson Hyperlegible (textos e campos) via @fontsource; (2) um botão verde por tela: `primary` = ação principal (verde #0B7F44, 64 px, Outfit 700 20, maiúsculas), `ghost` = secundário (branco, borda 2 azul, 56 px), `danger` = só texto vermelho ("Apagar"), opção escolhida = fundo azul névoa + borda azul + check, não escolhida = borda #6F829B; (3) ícones de traço (lucide-react) no lugar de todos os emojis; (4) barra de baixo com ícones (map-pin, file-text, paint-roller, sliders-horizontal), 80 px, pílula no item ativo; (5) nada abaixo de 16 px (exceto a barra de baixo), endereços em campo que cresce em vez de cortar, rótulos "Comp./Larg./Alt." em uma linha, plurais certos (`plural()`); (6) vermelho só para erro e "Apagar": "Falta" em azul, situações com `Badge` (Aberto azul, Fechado verde, Perdido cinza, Atenção âmbar); (7) PDFs: números em Outfit (zero liso) via componente `Text` de `quotePdf.tsx`, e itens de cada ambiente em 2 colunas (sala + quarto em 3 páginas). NÃO FEITO (aguarda aprovação do dono): seção "Cara da marca" (nome do pintor no topo, Medde em 4 lugares, régua de passos — o assistente de 6 passos já não existe, voz curta) e a decisão do Pix/cartão no PDF. Teste novo: sem estouro de largura em 360 e 390 px (`tests/ux.mjs`).
- IMPLEMENTADO ("Cara da marca, bem sutil", aprovada pelo dono): topo de Visitas e de Ajustes com o pintor (logo ou iniciais na cor dele, nome do negócio na cor dele, saudação por hora: "Boa noite, Carlos") — `BrandHeader`; a cor escolhida pelo pintor agora aparece SÓ aí e no PDF (o azul e o verde do app não mudam mais; `ThemeApplier`/`theme.ts` removidos — isso reverte o pedido anterior de pintar o app inteiro, a pedido do designer); marca do app em só 4 lugares: abertura (símbolo sobre azul, 1 s, uma vez por sessão, `Splash`, desligada em teste automático), Entrar/Criar conta, aviso "Fechou!" ao fechar um orçamento (`FechouNotice`) e rodapé de Ajustes ("Pintor Pro · versão 1.0"); nunca no PDF, recibo, cobrança nem mensagem de WhatsApp; régua de passos (`Ruler`) na configuração inicial (o assistente de 6 passos do orçamento já não existe); tagline "Mediu. Orçou. Fechou."; Pix no PDF mantido como QR + copia e cola (decisão do dono).

## Medidas por parede e custos da obra (implementado)
- **Medidas:** cada ambiente tem superfícies (Parede 1, 2, 3…, teto, piso) com largura × altura e tipo de pintura (acrílica, esmalte, piso, grafiato, cimento queimado). Parede nova repete altura e tipo da anterior. Sem categorização de estado da parede na visita. O orçamento puxa as medidas da visita (`visitRoomToRoom`) e escolhe os serviços pelo tipo de pintura (`PAINT_SERVICE`). Visitas antigas (comprimento × largura) continuam funcionando e são convertidas ao editar. Serviços novos (esmalte, piso, cimento queimado) têm **valores de exemplo** a confirmar com o pintor.
- **Custos da obra:** `Work.expenses` (material, ajudante, transporte, outros) e `Work.daysWorked`. `workProfit` compara previsto × real: "sobrou no bolso" (valor combinado − gastos) e "lucro final" (menos a diária = mão de obra prevista ÷ dias previstos × dias trabalhados). Base é o valor combinado; mostra quanto ainda falta receber. Painel de Obras mostra "Lucro real do mês" das obras com gastos.

## Primeiro uso mais leve (implementado)
- Onboarding caiu de 10 para **2 telas** (nome do negócio e WhatsApp). Cidade, diária, horas, margem, forma de receber e preços ficam com os valores padrão e podem ser ajustados em Ajustes.
- Ao terminar, o pintor vai direto ao **primeiro orçamento** (`/orcamentos/novo?primeiro=1`), com aviso de boas-vindas.
- **Confirme seus preços** (`PriceCheck`): no orçamento, os serviços usados que ainda têm valor de exemplo aparecem com a sugestão; o pintor confirma um por um ou todos de uma vez (isso tira a marca de "exemplo").
- Ideias para depois: cartão "faltam N passos" no painel (logo, Pix, preços) e perguntas em linguagem de pintor (faixa de preço em vez de margem %).

## Pix no primeiro orçamento e guia da visita (implementado)
- **Pix:** depois do primeiro orçamento salvo, a tela do orçamento oferece cadastrar a chave Pix (`PixSetupCard`, com validação). "Agora não" grava `Company.pixAsked`; depois dá para cadastrar em Ajustes.
- **Guia da visita:** na tela Visitas, cartão "Treine uma visita" cria uma visita de exemplo (`Visit.isExample`, com `Client.isExample`). `Tour` destaca cada bloco (cliente, fotos, medidas, observações, montar orçamento); o passo das medidas avança sozinho quando a pessoa anota um ambiente. Estado em `Company.tours.visita` (done/skipped), sincronizado com a conta. Apagar a visita de exemplo apaga o cliente de exemplo. Em Ajustes dá para rever o guia.
- Próximos: guia do orçamento e guia da obra reaproveitando `Tour`.

## Guias de todas as áreas (implementado)
- **Primeiro login:** depois das 2 perguntas, vai direto para **Visitas**, onde o guia abre sozinho.
- **Padrão único** (`Tour` + `AutoTour`): caixa curta embaixo (ou em cima, se o alvo estiver embaixo), bloco destacado, "Pular" e botão do passo. Guardado em `Company.tours` (visitas, visita, orcamento, obras, obra, ajustes) e sincronizado com a conta. Flag de testes: `localStorage["pintorpro:no-tours"]="1"`.
- **Cadeia:** Visitas (3 passos) → visita de exemplo (5) → orçamento (5) → Obras (2) → obra de exemplo (4) → Ajustes (5). Visita e obra de exemplo ficam marcadas "Exemplo", fora dos números do painel, e apagar a visita/obra apaga o cliente de exemplo.
- Em Ajustes, "Ver os guias de novo" reabre todos. Convite do Pix continua depois do primeiro orçamento salvo.
- Teste e2e: `tests/guias.mjs`. (`tests/pwa.mjs` está desatualizado: espera `/manifest.webmanifest`, que será criado quando fizermos o PWA.)
