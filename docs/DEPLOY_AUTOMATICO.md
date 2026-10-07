# Publicar no Supabase sem colar nada no painel

**Para quê.** Hoje, para cada função nova ou atualizada, é preciso copiar o código e colar no painel do Supabase. Com isto, **as funções e o SQL são publicados pelo GitHub**, e quem faz isso por você é uma rotina: eu mexo no código, a rotina publica, e eu confiro o resultado nos registros dela.

**Segurança (leia).** O GitHub guarda uma chave de acesso ao seu Supabase (`SUPABASE_ACCESS_TOKEN`). Essa chave **tem poder sobre toda a sua conta do Supabase**, então:
- ela fica **só nos "Secrets" do GitHub** (nunca no chat, no código ou em print);
- só quem tem acesso de escrita ao repositório consegue disparar as rotinas;
- se você desconfiar de vazamento, **apague a chave** em https://supabase.com/dashboard/account/tokens e crie outra.

## Ligar (uma vez, ~5 min, de preferência no computador)
1. **Criar a chave no Supabase:** https://supabase.com/dashboard/account/tokens → **Generate new token** → nome `github-deploy` → copie o texto (começa com `sbp_`). Ele só aparece uma vez.
2. **Guardar no GitHub:** repositório `vufreire-rgb/pintorpro` → **Settings → Secrets and variables → Actions → New repository secret**:
   - Nome: `SUPABASE_ACCESS_TOKEN` · Valor: a chave `sbp_...` → **Add secret**.
3. (Para rodar SQL pelo GitHub) o secret `SUPABASE_DB_URL` (conexão **Session pooler** com a senha do banco) é o mesmo do backup; se ainda não criou, veja `docs/BACKUP_E_PAUSA_SUPABASE.md`.
4. (Para a voz e o recibo) quando criar a chave da OpenAI, guarde também no GitHub, como secret `OPENAI_API_KEY`.

## Como usar
| Rotina | Para quê | Como rodar |
|---|---|---|
| **Supabase deploy (funções)** | Publica as funções (`push`, `quote-link`, `public-page`, `voice-quote`, `receipt-scan`, `delete-account`) com *Verify JWT desligado* | **Sozinha** quando algo em `supabase/functions` muda na `main`. Na mão: Actions → *Supabase deploy* → Run workflow (`todas` ou os nomes) |
| **Supabase migrate (SQL)** | Roda um arquivo de `supabase/migrations` (ex.: `0009_push.sql`) | Só na mão: Actions → *Supabase migrate* → Run workflow → nome do arquivo |
| **Supabase secrets** | Envia `OPENAI_API_KEY` do GitHub para o Supabase | Só na mão: Actions → *Supabase secrets* → Run workflow |

- O SQL **nunca roda sozinho**. Se um arquivo já foi rodado, a rotina mostra "already exists" e não estraga nada.
- Se faltar um secret, a rotina para com uma mensagem em português dizendo qual.
- Depois de publicar, abra a função no painel do Supabase só para **conferir** (aba Logs).

## O que ainda não foi testado
As rotinas foram escritas e a sintaxe conferida, mas **ainda não rodaram contra o seu projeto** (este ambiente não alcança o Supabase). A primeira execução é o teste: se der erro, o texto aparece nos registros da rotina e eu corrijo.
