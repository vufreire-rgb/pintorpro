# Página do pintor para receber pedidos de orçamento

**O que é.** Em **Ajustes → Página para receber pedidos**, o pintor ativa uma página pública `medde.com.br/p/<endereço>` (ex.: `/p/silva-pinturas`). Ele divulga o link (Instagram, WhatsApp, cartão). O cliente abre **sem instalar nada e sem login**, vê a apresentação do pintor e preenche nome, WhatsApp, endereço e o que precisa. O pedido aparece no app em **Orçamentos → Pedidos de clientes**, onde o pintor toca em **WhatsApp** (já marca "contatado") ou **Criar visita** (cria o cliente e uma visita com o que o cliente escreveu).

## Decisões de segurança
- Só a função `public-page` escreve em `public_pages` e `quote_requests`. O cliente nunca acessa o banco.
- A página mostra só: nome do negócio, cidade, WhatsApp, texto escrito pelo pintor e lista de serviços (opcional). Nada de Pix, preços, custos ou dados de clientes.
- **Contra spam (sem login e sem custo):** campo escondido que só robô preenche (descartado em silêncio); no máximo 40 pedidos por página por dia; mesmo telefone no mesmo dia conta uma vez; no máximo 300 pedidos "novos" pendentes por pintor; limites de tamanho nos textos. Não guardamos IP.
- Endereços reservados (`admin`, `api`, `o`, `p`, `pedidos`…) não podem ser usados; endereço repetido é recusado ("já está em uso").
- A página não vai para buscadores nesta versão (`noindex`): o pintor divulga o link. Dá para liberar depois.
- Desativar a página (ou excluir a conta) faz o link parar de funcionar; excluir a conta apaga os pedidos.

## LGPD
- O formulário avisa que nome, WhatsApp, endereço e o texto vão ao pintor, com link para a Política de privacidade.
- Cada pintor é responsável pelos contatos que recebe; o pintor pode apagar qualquer pedido. A política de privacidade precisa descrever isso (o jurídico revisa).

## Ligar (você, ~5 min)
1. **SQL Editor:** rodar `supabase/migrations/0008_public_pages.sql`.
2. **Edge Functions → Deploy a new function → Via Editor:** nome `public-page`, colar `supabase/functions/public-page/COLAR_NO_PAINEL.ts`, **Verify JWT desligado**. Sem chave ou secret.
3. Testar: Ajustes → Página para receber pedidos → Ativar → abrir o link numa janela anônima → enviar um pedido → ver em Orçamentos → Pedidos de clientes.

## Testado e não testado
- **Testado aqui:** limpeza de dados e anti-spam básico (`logic.test.ts`), textos e criação de visita (`publicPage.test.ts`) e o fluxo completo contra um servidor falso (`tests/pedidos.mjs`: ativar, cliente pedir sem login, erro de WhatsApp, pintor ver, criar visita, desativar).
- **Não testado:** a função e as tabelas no Supabase de verdade, e os limites diários (dependem do banco real).

## Ideias para depois
- Notificação no celular quando chega um pedido (junto com as notificações push).
- Fotos no pedido; liberar a página para buscadores; mais de um "modelo" de página.
