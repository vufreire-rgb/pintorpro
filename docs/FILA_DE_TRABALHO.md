# Fila de trabalho do Medde

Atualizado em 2026-10-08. Ordem = prioridade combinada com o titular. Marque o que mudar de lugar.

## Esperando você (destravam o resto)
1. **Domínio com HTTPS:** DNS já está certo; falta a Vercel emitir o certificado (conferir em Settings → Domains; ver se há registro CAA no Hostinger se passar de 2 h).
2. **3 secrets no GitHub** (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`): ligam o anti-pausa e o backup do Supabase (`docs/BACKUP_E_PAUSA_SUPABASE.md`).
3. **Supabase:** Redirect URLs (+ Site URL `https://medde.com.br` quando o HTTPS sair) e rodar `0003_subscriptions.sql` (`docs/LANCAMENTO_AUTENTICACAO.md`, `docs/ASSINATURA.md`).
4. **Contador / CNPJ** e escolha do gateway (`docs/RESUMO_PARA_CONTADOR.pdf`).
5. **Textos de privacidade, termos e exclusão de conta** (agente de burocracia) e e-mail de contato.
6. **Google Play:** conta de desenvolvedor, chave de assinatura (no computador do titular), 12+ testadores para o teste fechado de 14 dias (`docs/ANDROID_BUILD.md`).

## Fila do Claude (em ordem)
| # | Item | Depende de | Estimativa |
|---|---|---|---|
| 1 | **Notificações do Medde** (ver abaixo) | Domínio com HTTPS e PWA estável | 2 a 3 dias |
| 2 | Função que recebe o aviso do gateway e atualiza a assinatura (webhook) | Escolha do gateway (CNPJ) | 1 a 2 dias |
| 3 | `.aab` para o teste fechado do Google e `assetlinks.json` com a impressão digital | Domínio, chave de assinatura, conta Play | 0,5 a 1 dia |
| 4 | Ligar o controle de assinatura (`NEXT_PUBLIC_BILLING_ENFORCE=1`) e, opcional, `0004_enforce_subscription.sql` | Item 2 e um link de pagamento | 0,5 dia |
| 5 | Ajustes finais para o lançamento público: religar "Confirm email" (precisa SMTP próprio) | Domínio verificado no provedor de e-mail | 0,5 dia |
| 6 | Trena Bluetooth (Web Bluetooth, só Android) | Titular escolher o modelo | a definir |

## Item 1: Notificações do Medde (incluído a pedido do titular em 2026-10-08)
**Objetivo:** avisar o pintor com o app fechado, como uma mensagem, sem depender do calendário.
**Usos:**
- "Hora de revisar" os orçamentos abertos (hora e dias já escolhidos hoje em Orçamentos).
- Lembrete de **visita agendada** (ex.: 1 hora antes).
- Aviso de **assinatura** vencendo (3 dias antes e nos 3 dias depois).
- (Futuro) pagamento atrasado de obra, orçamento sem resposta.

**Como (Web Push):**
1. Gerar o par de chaves VAPID; a chave privada fica **só** como secret no Supabase.
2. Tabela `push_subscriptions` (usuário, endpoint, chaves, aparelho) com acesso apenas ao dono.
3. No app: pedir permissão **quando a pessoa ligar o lembrete** (nunca ao abrir), registrar a inscrição, tratar "negado" e "sem suporte" com mensagem clara; opção de desligar em Ajustes.
4. Service worker (`public/sw.js`): tratar o evento `push` e o toque na notificação (abre a tela certa).
5. Função agendada no Supabase (Edge Function + `pg_cron`) que, a cada minuto, procura lembretes devidos e envia; remove inscrições inválidas.
6. Fuso horário de Brasília (horário de verão não existe mais; guardar o fuso do aparelho).

**Limites conhecidos (explicar ao titular):**
- É uma **notificação**, não o alarme do relógio. Não toca com o celular em silêncio e depende de o sistema não economizar bateria do app.
- **iPhone:** só funciona com o Medde adicionado à Tela de Início (iOS 16.4 ou mais novo).
- Dados: o endereço do serviço de push do navegador (Google, Apple ou Mozilla) passa a ser guardado, e deve constar na política de privacidade.
- Excluir a conta apaga as inscrições (incluir na função `delete-account`).

**Pronto quando:** teste automático com servidor de push falso + teste manual em 1 Android e 1 iPhone instalados, com o app fechado; texto de privacidade atualizado.

## Proposta (aguardando decisão do titular, 2026-10-08): Orçamento por voz
**Ideia (vista em outro app):** o pintor abre o app, **dita** o que precisa ("sala 4 por 5, paredes e teto, duas demãos, R$ 1.800, entrada de 50%") e o app **transcreve e monta o orçamento**, sem calcular nada dentro do app: vale o preço que o pintor fala (ele faz a conta do jeito dele).
**Versão enxuta (MVP):**
1. Botão de microfone no novo orçamento; ditado pelo navegador (grátis no Chrome/Android) ou transcrição paga; **não guarda o áudio**, só o texto.
2. Uma função no Supabase manda o texto à IA (modelo barato) com a chave guardada como secret no servidor; devolve cliente, endereço, ambientes, serviços, **valor total**, prazo e forma de pagamento.
3. Tela de **revisão** (a pessoa confere e corrige), depois PDF e WhatsApp como hoje.
4. Novo modo de orçamento com **preço fechado** (valor digitado/ditado, sem usar o motor de cálculo); o motor continua para quem quiser ajuda no cálculo.
**Custo estimado:** cerca de **R$ 0,10 por orçamento** ditado (1,5 min); 20 por mês ≈ R$ 2 por pintor (≈ 6% da assinatura). Limite mensal por conta para não estourar.
**Cuidados:** a chave da IA só como secret no servidor (nunca no app nem no chat); política de privacidade deve citar o envio da voz/texto ao provedor de IA; sem internet o pintor digita.
**Estimativa:** 3 a 5 dias para o MVP + testes com fala real de pintor.
**Sugestão de prioridade:** antes das notificações, por reduzir o maior atrito (digitar).

## Ideias guardadas (sem data)
- Alarme de verdade do relógio: só com app nativo; hoje não vale o custo.
- Voz para orçamento (IA): precisa de chave de API e estimativa de custo (`docs/CUSTOS_IA.md`).
- Cobrança por colaborador (R$ 14,90 no documento mestre).
- Pagamento dentro do Google Play (taxa ~15%), após confirmar a regra vigente.


## Orçamento por voz — status (2026-10-07)
Construído e testado com servidor falso; **falta ligar de verdade**: chave OpenAI → secret `OPENAI_API_KEY`, rodar `0005_voice_usage.sql`, publicar a função `voice-quote`. Passo a passo em `docs/ORCAMENTO_POR_VOZ.md`. Depois: testar com fala real de obra e ajustar o prompt/modelo.

## Novidades prontas na branch (2026-10-07), faltam só ligar no Supabase
| Recurso | O que rodar/publicar | Guia |
|---|---|---|
| Voz (ditado) | secret `OPENAI_API_KEY`, `0005_voice_usage.sql`, função `voice-quote` | `docs/ORCAMENTO_POR_VOZ.md` |
| Recibo por foto | `0006_receipt_usage.sql`, função `receipt-scan` (mesma chave) | `docs/ORCAMENTO_POR_VOZ.md` |
| Link do orçamento (visto pelo cliente) | `0007_shared_quotes.sql`, função `quote-link` | `docs/LINK_DO_ORCAMENTO.md` |
| Página de pedidos do pintor | `0008_public_pages.sql`, função `public-page` | `docs/PAGINA_DE_PEDIDOS.md` |
| Resultado do mês, Primeiros passos, modo simples | nada (só app) | — |

Todas as funções: **Verify JWT desligado**. Só voz e recibo usam a chave da OpenAI.
Próximo da fila: notificações push (inclui avisar "cliente abriu o link" e "novo pedido").
