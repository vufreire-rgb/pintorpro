# Exclusão de conta — como ligar no Supabase

O botão **Excluir minha conta** (Ajustes → Conta) chama uma função do Supabase chamada `delete-account`. Sem essa função publicada, o app responde "Não consegui excluir agora" e **nada é apagado**.

A função roda no servidor com a chave de administrador (que o Supabase já injeta nas Edge Functions; **você não precisa copiar nem configurar nenhuma chave**). Ela descobre quem está pedindo pelo token de login e só apaga a **própria** conta.

## O que ela apaga (nesta ordem)
1. Todas as fotos e áudios da pessoa no Storage (`visit-files/<id>/…`).
2. A linha de dados da conta (`user_data`).
3. O usuário (`auth.users`).

Se algo falhar antes do passo 3, a conta continua existindo e a pessoa pode tentar de novo.

## Publicar a função (1 vez) — pelo painel, sem instalar nada
1. Painel do Supabase → seu projeto → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome da função: `delete-account` (exatamente assim).
3. Apague o exemplo e cole **todo** o conteúdo do arquivo `supabase/functions/delete-account/COLAR_NO_PAINEL.ts` (está no repositório do GitHub).
4. Deixe ligada a opção de **verificar o login (Verify JWT)**. Clique em **Deploy**.
5. Em **Edge Functions**, confira que `delete-account` aparece como ativa.

(Alternativa com a linha de comando: `supabase functions deploy delete-account --project-ref <id-do-projeto>`.)

## Testar
1. Crie uma conta de teste no app, tire uma foto e salve uma visita.
2. Ajustes → **Excluir minha conta** → digite EXCLUIR → confirme.
3. No painel: **Authentication → Users** (o usuário sumiu) e **Storage → visit-files** (a pasta dele sumiu).

## Quando mudar o código
Se alguém editar `logic.ts` ou `index.ts`, rode `node supabase/functions/delete-account/gerar-arquivo-unico.mjs` para atualizar o `COLAR_NO_PAINEL.ts` (o teste automático avisa se esquecer) e publique de novo.

## O que continua fora do app
- Logs de infraestrutura do Supabase e da Vercel seguem a retenção de cada provedor.
- O Supabase não mantém backups próprios no plano Free (confirmar no painel).
