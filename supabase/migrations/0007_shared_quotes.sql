-- Medde — link público do orçamento, com aviso de quando o cliente abriu.
-- Quem escreve é só o servidor (Edge Function quote-link). O pintor só LÊ as próprias linhas (para ver as visualizações).
-- O cliente nunca acessa a tabela: ele abre o link, e a função devolve o orçamento daquele token.

create table if not exists public.shared_quotes (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  user_id         uuid not null references auth.users (id) on delete cascade,
  quote_id        text not null,
  snapshot        jsonb not null,
  views_count     integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, quote_id)
);

alter table public.shared_quotes enable row level security;

-- O pintor lê só as próprias linhas. Não há política de insert/update/delete: o app não escreve aqui.
create policy "shared_quotes_select_own" on public.shared_quotes
  for select using (auth.uid() = user_id);
