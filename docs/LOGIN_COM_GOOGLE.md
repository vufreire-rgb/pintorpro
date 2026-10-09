# Entrar com o Google (opcional)

**Para quê:** muitos pintores não lembram a senha do e-mail. Com este botão, quem tem Android entra com a conta Google em um toque.

**Estado:** o código já está pronto e o botão **fica escondido** até você ligar. Falta configurar o Google e o Supabase.

## Passos (uma vez, no computador)
1. **Google Cloud:** abra https://console.cloud.google.com → crie um projeto "Medde" → **APIs e serviços → Tela de consentimento OAuth** → tipo **Externo** → nome do app "Medde", e-mail de suporte, domínio `medde.com.br`, links de privacidade e termos (`https://medde.com.br/privacidade`, `/termos`). Publique o app (modo produção).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.**
   - **Origens JavaScript autorizadas:** `https://medde.com.br`
   - **URIs de redirecionamento autorizados:** `https://dafelzfidqxuntvkkgrd.supabase.co/auth/v1/callback`
   - Copie o **ID do cliente** e a **chave secreta do cliente**. (A chave secreta vai só no Supabase. Nunca no chat.)
3. **Supabase:** https://supabase.com/dashboard/project/dafelzfidqxuntvkkgrd/auth/providers → **Google** → ligar → colar o ID e a chave secreta → **Save**.
4. **Supabase → Authentication → URL Configuration:** confira que `https://medde.com.br/**` está em Redirect URLs.
5. **Vercel → Settings → Environment Variables:** criar `NEXT_PUBLIC_GOOGLE_LOGIN` = `1` → **Redeploy**.
6. **Teste:** abra o app deslogado (janela anônima). Deve aparecer "Entrar com o Google". Entre com uma conta de teste.

## Cuidados
- Quem entra pelo Google não tem senha no Medde: o "Esqueci minha senha" não se aplica. Não há troca de e-mail.
- O Google mostra o nome do app e o e-mail na tela de consentimento: a política de privacidade deve citar o login com o Google.
- Se o botão não abrir o login: confira o passo 2 (a URI de redirecionamento precisa ser idêntica) e o passo 4.
