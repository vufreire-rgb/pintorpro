# Orçamento por voz — como ligar

**O que é.** Em Orçamentos → **Ditar orçamento por voz**, o pintor fala (cliente, cômodos com medidas, preço) e o app monta o orçamento. Ele **confere numa tela de revisão** antes de salvar. Se disser um **preço fechado**, o total do orçamento fica exatamente nesse valor.

**Como funciona (segurança e LGPD).**
- O app grava o áudio e manda para a Edge Function `voice-quote` (Supabase). Só quem está logado consegue usar.
- A função manda o áudio à OpenAI para virar texto (`gpt-4o-mini-transcribe`) e o texto para extrair os dados (`gpt-4o-mini`). **O áudio não é guardado** em lugar nenhum.
- A **chave da OpenAI fica só no Supabase (Secrets)**. O app nunca a recebe. Nunca cole a chave no chat.
- Limite de **40 orçamentos por voz por pessoa por dia** (tabela `voice_usage`).
- **Política de privacidade:** incluir que o áudio e o texto ditados são enviados à OpenAI (EUA) só para transcrever, sem guardar. Conferir o DPA da OpenAI.

**Custo.** ~R$ 0,10 por orçamento (ver `docs/CUSTOS_IA.md`). Defina um **teto de gasto mensal** na OpenAI (passo 3 abaixo).

## Passo a passo (uma vez, ~15 min)

### 1. Criar a chave na OpenAI
1. Entre em https://platform.openai.com e crie a conta (é diferente do ChatGPT; use o e-mail da empresa).
2. **Settings → Billing → Add payment method** e coloque **US$ 5 a 10** de crédito (pré-pago; acabou o crédito, para de funcionar, não cobra a mais).
3. **Settings → Limits** (ou *Billing → Limits*): defina **Monthly budget = US$ 10** e um alerta em US$ 5.
4. **API keys → Create new secret key**. Nome: `medde-voz`. Permissões: pode ser *Restricted* e liberar só **Model capabilities** (Audio e Chat completions).
5. **Copie a chave (começa com `sk-`) agora**: ela só aparece uma vez. Guarde no gerenciador de senhas.

### 2. Guardar a chave no Supabase (não no chat)
Supabase → **Edge Functions → Secrets** (ou *Project Settings → Edge Functions*) → **Add new secret**: nome `OPENAI_API_KEY`, valor = a chave. Salvar.

### 3. Criar a tabela do limite diário
Supabase → **SQL Editor** → cole o conteúdo de `supabase/migrations/0005_voice_usage.sql` → **Run**.

### 4. Publicar a função
Supabase → **Edge Functions → Deploy a new function → Via Editor**. Nome: `voice-quote`. Cole **todo** o conteúdo de `supabase/functions/voice-quote/COLAR_NO_PAINEL.ts`. Em *Settings* da função, deixe **Verify JWT desligado** (a função confere o login sozinha, como a `delete-account`). **Deploy**.

### 5. Testar
No celular, no app: Orçamentos → **Ditar orçamento por voz** → falar um orçamento curto → conferir → salvar. Se der erro, mande o print.

## O que foi testado aqui e o que não foi
- **Testado:** a limpeza do que a IA devolve (`logic.test.ts`), a montagem do orçamento e o preço fechado (`voice.test.ts`), e o fluxo no app contra um servidor falso (`tests/voz.mjs`).
- **Não testado:** a chamada real à OpenAI (a rede daqui bloqueia) e a qualidade da compreensão com fala de obra. O primeiro teste real é o passo 5. Se a IA errar muito, trocamos para modelos maiores (custo sobe um pouco).

## Limites conhecidos (primeira versão)
- Cômodos retangulares (4 paredes + teto opcional) ou só "X m² de parede".
- Um tipo de tinta por cômodo. Serviços de preparo seguem o estado da parede (padrão: já pintada).
- Cliente com o mesmo nome de um existente é reaproveitado.
- Precisa de internet e de conta.
