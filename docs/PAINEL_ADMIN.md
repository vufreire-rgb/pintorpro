# Painel do administrador (só do titular)

Página `/painel` do app (e `admin.medde.com.br`, quando o domínio estiver ligado). Mostra números do Medde: assinantes, orçamentos, uso da IA, contas sumidas e meta. Pensado para o celular.

## Quem pode ver
Só a conta do e-mail de administrador. Padrão: `vufreire@gmail.com`; pode trocar com o secret `ADMIN_EMAIL` das funções (e, para mais segurança, `ADMIN_USER_ID` com o id da conta). O servidor confere o login; quem não for administrador vê "Sem acesso" e nenhum número.
O painel mostra **totais** e o contato dos pintores (nome, e-mail, WhatsApp). Nunca mostra dados dos clientes deles. Isso precisa constar na política de privacidade.

## O que mostra
- Meta de assinantes com barra (meta e data digitadas por você).
- Assinantes pagando, em teste, teste vencido, atrasados e cancelados.
- Orçamentos gerados, valor orçado e fechado, taxa de fechamento, contas novas por dia, sempre comparando com o período anterior (7 dias ou mês até hoje).
- Contas sumidas (7 dias sem usar) e teste acabando (próximos 3 dias), com botão para chamar no WhatsApp.
- Funil: cadastrou → primeira visita → primeiro orçamento → enviou pelo link → fechou. Dados de exemplo do app não contam.
- Uso e custo da IA (voz e recibo, com o custo por uso que você digita).
- Dinheiro: faturamento, imposto e lucro ficam em "—" até o pagamento estar ligado. Custo de IA e custos fixos já aparecem.

## Como ligar (uma vez)
1. **Banco:** GitHub → Actions → "Supabase migrate (SQL)" → Run workflow → arquivo `0010_admin_settings.sql`.
2. **Função:** publica sozinha quando o código entra na `main` (workflow "Supabase deploy"); se quiser na mão, Actions → "Supabase deploy" → `admin-stats`.
3. **Usar:** entre no app com a sua conta e abra `medde.com.br/painel`.
4. **Domínio (opcional):** Vercel → Settings → Domains → adicionar `admin.medde.com.br`; no Hostinger criar o registro CNAME `admin` apontando para o valor que a Vercel mostrar. O app já abre o painel nesse endereço.

## Limites conhecidos
- "Ativa" = abriu o app ou salvou dados nos últimos 7 dias. Quem fica sem internet por dias aparece como sumida sem estar.
- O app guarda os dados primeiro no aparelho e envia depois: orçamentos ainda não enviados não entram na contagem.
- Faturamento, cancelamentos e "teste que virou assinatura" dependem do pagamento (webhook do gateway).
- O alerta no celular a cada nova assinatura será ligado junto com o webhook do pagamento.
- Testado contra um Supabase falso (`tests/painel.mjs`) e com testes das regras de contagem (`supabase/functions/admin-stats/logic.test.ts`); **não testado contra o Supabase real**.
