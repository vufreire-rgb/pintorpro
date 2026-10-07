# Link do orçamento (com aviso de "o cliente abriu")

**O que é.** Na tela do orçamento, **Enviar link (avisa quando abrir)** cria um endereço `medde.com.br/o/<código>` e abre o WhatsApp com a mensagem pronta. O cliente abre o link no celular, **sem instalar nada e sem login**, vê o orçamento (valor, o que será feito, prazo, pagamento, Pix, combinados) e fala com o pintor. O pintor vê **"O cliente abriu 2 vezes. Última há 2 h."** na tela do orçamento e **"Visto há …"** na lista.

## Segurança e privacidade (decisões tomadas)
- O código do link tem 24 caracteres aleatórios (impossível de adivinhar). Quem tem o link vê o orçamento. É o mesmo conteúdo do PDF, **sem fotos e sem logo** (o logo é privado), e **nunca** custo, lucro ou margem (há teste que garante isso).
- O link mostra **nome e endereço do cliente** para quem o recebeu. Citar na política de privacidade.
- Só a função `quote-link` escreve na tabela `shared_quotes`; o pintor só lê as próprias linhas (RLS). O cliente nunca acessa o banco.
- A página do cliente não aparece em buscadores (`noindex`).
- Apagar o orçamento ou tocar em **Cancelar link** faz o endereço parar de funcionar. Excluir a conta apaga todos os links.
- Várias aberturas dentro de 10 minutos contam como uma só (para a contagem não inflar com atualizar a página). Prévia do WhatsApp não conta (a página só conta quando o JavaScript abre).
- Se o pintor editar o orçamento, o link mostra a versão antiga até ele tocar em "Enviar o link de novo" (o app avisa).
- Rodapé da página do cliente: **"Orçamento feito com Medde"** (leva a medde.com.br). É o que ajuda o app a se espalhar. Se quiser que o pintor possa desligar, é um ajuste pequeno.

## Ligar (você, ~5 min)
1. **SQL Editor:** rodar `supabase/migrations/0007_shared_quotes.sql`.
2. **Edge Functions → Deploy a new function → Via Editor:** nome `quote-link`, colar `supabase/functions/quote-link/COLAR_NO_PAINEL.ts`, **Verify JWT desligado** (a função confere o login do pintor sozinha; o cliente não tem login). **Não precisa de chave nem secret.**
3. Testar: abrir um orçamento no app → Enviar link → abrir o link em outra janela anônima → voltar ao orçamento e ver "O cliente abriu 1 vez".

## Testado e não testado
- **Testado aqui:** limpeza dos dados (`logic.test.ts`), textos e snapshot sem custo (`quoteLinks.test.ts`) e o fluxo completo contra um servidor falso (`tests/link.mjs`: publicar, cliente abrir sem login, pintor ver "visto", link inexistente, cancelar).
- **Não testado:** a função e a tabela no Supabase de verdade (a rede daqui bloqueia). O primeiro teste real é o passo 3.

## Ideias para depois
- O cliente tocar em **Aceitar** no link e o orçamento virar "Fechado" sozinho.
- Fotos da visita no link (precisa de um bucket público com links assinados).
- Aviso (notificação) para o pintor quando o cliente abre, junto com as notificações push.
