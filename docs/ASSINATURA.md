# Assinatura do Medde: como funciona e como ligar

**Estado:** o controle (teste de 30 dias, avisos e bloqueio) está **pronto, mas DESLIGADO**. O app só o usa quando a variável `NEXT_PUBLIC_BILLING_ENFORCE=1` existe. **O pagamento em si (gateway) ainda não existe**: o controle funciona sozinho, e o gateway só vai alimentá-lo depois.

## Regras (definidas pelo titular, 2026-10-07)
| Situação | O que o app faz |
|---|---|
| Teste grátis (30 dias, a partir da criação de cada conta) ou assinatura em dia | Acesso normal |
| Faltam 3 dias ou menos para vencer | Faixa de aviso no topo: "Seu teste grátis termina em N dias" / "Sua assinatura vence em N dias", com botão de pagar |
| Venceu há menos de 3 dias | Faixa: "Seu teste grátis terminou" / "Pagamento pendente. O acesso será bloqueado em N dias." O app ainda funciona |
| Venceu há 3 dias ou mais | **Tela de bloqueio**: assinar, baixar os dados, excluir a conta, sair. Nada do app abre |

Valor: **R$ 29,90 por mês** (texto em `PRICE_LABEL`, `src/modules/billing.ts`).

> **Padrões que usei sem resposta do titular (fáceis de trocar):** valor R$ 29,90; os 30 dias contam por conta; bloqueado = só a tela de pagamento (com baixar dados, excluir conta e sair sempre disponíveis, como a LGPD pede).

## Onde mora cada coisa
- `supabase/migrations/0003_subscriptions.sql`: tabela `subscriptions` (uma linha por usuário). O usuário só **lê** a própria linha; quem escreve é o servidor. Todo usuário novo ganha 30 dias de teste automaticamente; quem já tinha conta ganha 30 dias a partir do dia em que a migração rodar.
- `src/modules/billing.ts`: regras de datas (testadas nas fronteiras exatas em `billing.test.ts`).
- `src/modules/subscription.ts`: busca a situação ao entrar, ao voltar para o app e a cada 30 min. Sem internet usa a última resposta; sem nenhuma resposta, **não bloqueia** (falha aberta).
- Telas: `BillingBanner`, `BlockedScreen`, `SubscriptionCard` (em Ajustes) e o botão "Baixar meus dados".

## Passo a passo para ligar (quando houver pagamento)
1. **Criar a tabela:** Supabase → SQL Editor → colar `supabase/migrations/0003_subscriptions.sql` → Run. Pode fazer já, sem efeito visível.
2. **Conferir:** Table Editor → `subscriptions` deve ter uma linha por usuário.
3. **Liberar alguém manualmente** (até o gateway existir), no SQL Editor:
   ```sql
   update public.subscriptions
      set status = 'active', current_period_end = now() + interval '1 month', updated_at = now()
    where user_id = (select id from auth.users where email = 'pessoa@exemplo.com');
   ```
   Para prolongar o teste: `update public.subscriptions set trial_ends_at = now() + interval '30 days' where user_id = ...;`
4. **Ligar o controle:** Vercel → projeto → Settings → Environment Variables:
   - `NEXT_PUBLIC_BILLING_ENFORCE` = `1`
   - `NEXT_PUBLIC_CHECKOUT_URL` = o link de pagamento (quando existir)
   Depois, **Redeploy**. Sem `CHECKOUT_URL`, a tela de bloqueio diz que o pagamento ainda está sendo preparado.
5. **Teste o fluxo** com uma conta descartável: ajuste a data no SQL para daqui a 2 dias, depois para ontem, depois para 4 dias atrás, e confira faixa, faixa de bloqueio e tela de bloqueio.

> **Não ligue o controle antes de existir um jeito de pagar**, senão os testadores serão bloqueados sem saída. Com 30 dias de teste a partir de hoje, a primeira conta só chegaria ao bloqueio em novembro.

## Opcional: o banco também recusar gravações de quem está bloqueado
`supabase/optional/0004_enforce_subscription.sql`. Sem ele, o bloqueio é só da tela do app (quem mexer no aparelho poderia contorná-lo). Aplique **só depois** de testar tudo, com uma conta descartável. O arquivo traz o jeito de desfazer.

## O que falta (depende de CNPJ e de escolher o gateway)
1. Conta no gateway e o link de pagamento (assinatura mensal, Pix automático e/ou cartão).
2. Uma função de servidor (Edge Function) que **recebe o aviso do gateway** ("pagou", "atrasou", "cancelou") e atualiza `subscriptions` (`status`, `current_period_end`, `provider_*`). Esse é o único jeito seguro: o app nunca escreve nessa tabela.
3. Decidir se a assinatura também será oferecida dentro do Google Play (ver conversa sobre lojas) e confirmar a regra vigente para link de pagamento dentro do app Android.
4. E-mails de cobrança/recibo e nota fiscal, com o contador.

## Limites atuais
- O relógio usado é o do aparelho; o banco (opcional 0004) é o que impede de verdade a gravação de quem está bloqueado.
- Não há "cobrar por colaborador" (R$ 14,90 no documento mestre): só um plano por conta.
- Testado contra um Supabase falso (`tests/assinatura.mjs`); **não testado contra o Supabase real**.
