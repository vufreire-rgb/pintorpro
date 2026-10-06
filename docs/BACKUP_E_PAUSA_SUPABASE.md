# Supabase Free: evitar a pausa e fazer backup

**Por quê.** Pela documentação do Supabase, um projeto do plano Free é **pausado após 7 dias sem consultas ao banco** (visitar o painel não conta). Durante o teste fechado do Google, se ninguém usar o app por uma semana, ele sai do ar. Além disso, o plano Free **não faz backup**: o próprio Supabase recomenda exportar os dados com `db dump` e guardar uma cópia fora dele.

Fontes: https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/docs/guides/platform/backups

**Solução (grátis, usa o GitHub do projeto):**

| Rotina | Arquivo | Quando | O que faz |
|---|---|---|---|
| Manter acordado | `.github/workflows/supabase-keepalive.yml` | todo dia | Faz 1 consulta simples no banco (conta como atividade). Se falhar, o GitHub manda e-mail |
| Backup | `.github/workflows/supabase-backup.yml` | toda segunda | Gera o dump do banco, **criptografa** (AES-256) e guarda 35 dias |

> As duas rotinas só rodam depois que o código estiver na `main` (o GitHub só agenda tarefas a partir da branch principal).

## O que o backup cobre e o que NÃO cobre
- **Cobre:** todos os dados do app (a tabela `user_data` guarda clientes, visitas, orçamentos, obras e pagamentos de cada conta) e os usuários (`auth.users`, `auth.identities`, com a senha já em hash).
- **Não cobre:** **fotos e áudios** (Storage `visit-files`). Para elas, baixe pelo painel (Storage → visit-files) de vez em quando, ou me peça uma rotina de cópia.
- **Não cobre:** o código das funções (já está no GitHub) e as configurações do painel (anote as importantes).

## Configurar (uma vez, ~10 minutos, de preferência no computador)
No GitHub: repositório `vufreire-rgb/pintorpro` → **Settings → Secrets and variables → Actions → New repository secret**. Crie estes 3:

| Nome do secret | O que colocar | Onde pegar |
|---|---|---|
| `SUPABASE_PUBLISHABLE_KEY` | A chave **publishable** (pública) | Supabase → Project Settings → API Keys → *Publishable key* |
| `SUPABASE_DB_URL` | A conexão do banco no modo **Session pooler** | Supabase → botão **Connect** → *Session pooler* → copie a URI e troque `[YOUR-PASSWORD]` pela senha do banco |
| `BACKUP_PASSPHRASE` | Uma **frase longa que só você sabe** (20+ caracteres) | Invente e **guarde no gerenciador de senhas** |

Cuidados:
- A **senha do banco** e a **frase do backup** vão **só** nesses campos do GitHub. **Nunca** cole no chat, e-mail ou no código.
- Use **Session pooler** (e não "Direct connection"): o GitHub só usa IPv4 e a conexão direta do plano Free é IPv6.
- Se esqueceu a senha do banco: Supabase → Project Settings → Database → *Reset database password*.
- **Perdeu a `BACKUP_PASSPHRASE` = backups ilegíveis.** Guarde em 2 lugares.

## Testar (depois dos secrets e depois que estiver na `main`)
1. GitHub → aba **Actions**.
2. Toque em **Supabase keepalive** → **Run workflow**. Deve ficar verde.
3. Toque em **Supabase backup** → **Run workflow**. Deve ficar verde e criar o arquivo `medde-backup` (aparece em *Artifacts*, no fim da página da execução).

Se falhar, abra a execução e mande o print da mensagem de erro (ela não mostra senhas).

## Rotina mensal (5 minutos)
1. GitHub → Actions → **Supabase backup** → última execução verde → baixe o artefato `medde-backup`.
2. Guarde o arquivo `.sql.gpg` fora do GitHub (no seu computador e num armazenamento privado na nuvem). **Ele é criptografado**, mas ainda contém dados pessoais: trate como confidencial.
3. Apague as cópias com mais de 12 meses, ou conforme a política de privacidade definir.

## Restaurar (se um dia precisar)
No computador, com o `gpg` e o `psql` instalados:

```
gpg --decrypt medde-backup-AAAA-MM-DD.sql.gpg > backup.sql      # pede a frase
psql "<conexão do banco novo>" -f backup.sql
```

Restaurar usuários (`auth.users`) em um projeto novo exige cuidado e é melhor fazer com ajuda. **Não restaure por cima de um banco em uso sem falar comigo antes.**

## Pontos de atenção
- **LGPD:** o backup criptografado fica armazenado no GitHub (EUA) por até 35 dias, e as suas cópias mensais, onde você guardar. Isso deve constar na política de privacidade.
- **Testado aqui:** a sintaxe dos arquivos e a criptografia/descriptografia. **Não testado:** a conexão com o Supabase real (a rede do ambiente de desenvolvimento bloqueia). O primeiro "Run workflow" é o teste de verdade.
- **Se o projeto já tiver pausado:** Supabase → o projeto → *Restore project* (possível por até 1 ano).
- **Para parar de depender disso:** o plano **Pro** do Supabase evita a pausa e inclui backups diários.
