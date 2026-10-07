# Notificações no celular (Web Push)

**O que é.** Avisos no celular do pintor, mesmo com o app fechado: **"O cliente abriu seu orçamento"** (na primeira abertura e depois só se passarem 6 horas) e **"Novo pedido de orçamento"** (quando alguém envia pelo link da página). Tocar no aviso abre o app na tela certa. O pintor liga em **Ajustes → Notificações** (ou pelo botão "Avisar no celular quando o cliente abrir", na tela do orçamento).

## Como funciona (decisões)
- Função `push`: guarda os aparelhos (tabela `push_subscriptions`) e envia. O par de chaves do servidor (VAPID) **é criado sozinho na primeira chamada** e fica na tabela `push_keys`, sem acesso pelo app. **Você não copia nem cola nenhuma chave.**
- As funções `quote-link` e `public-page` chamam a `push` por dentro do Supabase, usando a chave de administrador que já existe no servidor. Quem não tem essa chave não consegue mandar aviso (conferência em tempo constante).
- A notificação só leva texto curto (nome do cliente e número do orçamento, **sem valores**, para não aparecer na tela bloqueada) e um endereço **dentro do app** (qualquer outro vira a tela inicial).
- Aparelho que cancelou ou desinstalou (erro 404/410 do serviço de push) é apagado sozinho. Máximo de 8 aparelhos por pintor.
- iPhone: só funciona com o app **instalado na tela inicial** (iOS 16.4 ou mais novo). O app avisa isso. Android (Chrome) funciona direto.

## Ligar (você, ~10 min)
1. **SQL Editor:** rodar `supabase/migrations/0009_push.sql`.
2. **Edge Functions → Deploy a new function → Via Editor:** nome `push`, colar `supabase/functions/push/COLAR_NO_PAINEL.ts`, **Verify JWT desligado**.
3. **Atualizar as duas funções que já existem** (colar o código novo por cima e Deploy; o Verify JWT continua desligado):
   - `quote-link` ← `supabase/functions/quote-link/COLAR_NO_PAINEL.ts`
   - `public-page` ← `supabase/functions/public-page/COLAR_NO_PAINEL.ts`
4. Abrir o app (fechar e abrir de novo) → **Ajustes → Notificações → Ligar avisos neste celular** → permitir → **Enviar teste**.

## Testado e não testado
- **Testado aqui:** limpeza dos dados e regras de aviso (`supabase/functions/push/logic.test.ts`), o comportamento do service worker ao receber e tocar numa notificação (`src/modules/sw.test.ts`), e o fluxo do app (ligar, testar, desligar, permissão bloqueada, iPhone sem instalar) com a inscrição simulada (`tests/push.mjs`).
- **Não testado:** a entrega real da notificação (o ambiente de desenvolvimento não alcança os serviços de push do Google/Apple) e a biblioteca `web-push` rodando no Supabase. **O teste de verdade é o botão "Enviar teste" no seu celular.** Se der erro, o Supabase mostra em Edge Functions → push → Logs.

## Ideias para depois
- Avisar também: parcela vencendo e obra começando amanhã.
- Escolher quais avisos receber.
