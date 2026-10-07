# Login: "esqueci a senha" e confirmação de e-mail — o que ligar no Supabase

**O código do app já está pronto** (esqueci a senha, link vencido, nova senha, reenvio do e-mail de confirmação, e-mail volta para o app). Falta **configurar o Supabase**, na ordem abaixo. Testado contra um Supabase falso (`tests/senha.mjs`); **não testado com e-mails reais**.

## Por que a ordem importa
O e-mail embutido do Supabase permite **só 2 e-mails por hora** (confirmação, "esqueci a senha" e convite somados). Com "Confirm email" ligado e esse limite, a 3ª pessoa do dia **não consegue criar conta** nem recuperar a senha. Por isso **o "Confirm email" só pode ser ligado depois de configurar um envio de e-mail próprio (SMTP)**. Com SMTP próprio o limite padrão é de 30 novos usuários por hora (ajustável).

Fonte: https://supabase.com/docs/guides/deployment/going-into-prod

## Passos (no painel do Supabase: Authentication)
Link do projeto: https://supabase.com/dashboard/project/dafelzfidqxuntvkkgrd/auth/url-configuration

### 1. URL Configuration (pode fazer já)
- **Site URL:** `https://pintorpro-gules.vercel.app` agora; troque para `https://medde.com.br` quando o domínio estiver no ar.
- **Redirect URLs** (adicione todas; o `/**` no fim é necessário):
  - `https://medde.com.br/**`
  - `https://www.medde.com.br/**`
  - `https://pintorpro-gules.vercel.app/**`
  - `http://localhost:3000/**`
- Sem isso, o link do e-mail não volta para o app (o Supabase recusa o destino).

### 2. SMTP próprio (antes de ligar o Confirm email)
- Authentication → **Emails → SMTP Settings** → ativar **Custom SMTP**.
- Precisa de um serviço de envio. Opções com plano grátis: **Resend**, **Brevo**, **Amazon SES** (centavos). Para boa entrega, o serviço pede para **verificar o domínio** `medde.com.br` (alguns registros DNS no Hostinger). **Por isso depende do domínio estar ativo.**
- Remetente sugerido: `Medde <nao-responda@medde.com.br>`.
- Guarde o usuário e a senha do SMTP só no painel do Supabase e no gerenciador de senhas. Nunca no chat.

### 3. Textos dos e-mails em português
Authentication → **Emails → Templates**. Cole:

**Confirm signup** — assunto: `Confirme seu e-mail no Medde`
```html
<h2>Bem-vindo ao Medde</h2>
<p>Toque no botão para confirmar seu e-mail e começar.</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#0b7f44;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Confirmar meu e-mail</a></p>
<p>Se você não criou uma conta, ignore esta mensagem.</p>
```

**Reset password** — assunto: `Nova senha do Medde`
```html
<h2>Criar uma nova senha</h2>
<p>Você pediu para trocar a senha do Medde. Toque no botão para escolher uma nova.</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#0b7f44;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Escolher nova senha</a></p>
<p>O link vale por pouco tempo. Se não foi você, ignore esta mensagem: sua senha continua a mesma.</p>
```

### 4. Ligar o Confirm email (só depois dos passos 1 a 3)
Authentication → **Sign In / Providers → Email → Confirm email: ligado**. Depois da mudança, testes:
1. Criar conta nova → recebe o e-mail → toque no link → entra no app.
2. "Esqueci minha senha" → recebe o e-mail → link → escolhe a senha nova → entra.
3. Tentar entrar sem confirmar → o app explica e oferece "Reenviar e-mail de confirmação".

## Para o beta de outubro (convidados)
Enquanto o domínio e o SMTP não estiverem prontos, **deixe "Confirm email" desligado** (como está). Os convidados entram sem confirmar, e o "esqueci a senha" funciona, **mas limitado a 2 e-mails por hora**. Se alguém esquecer a senha e o limite estourar, o app mostra "Muitas tentativas. Aguarde alguns minutos".

## O que não existe ainda
- Troca de e-mail e exclusão de conta por e-mail (a exclusão está no app: Ajustes → Excluir minha conta).
- Login por Google/Apple (as lojas só exigem "Entrar com a Apple" se houver outro login social; só e-mail e senha não exige).
