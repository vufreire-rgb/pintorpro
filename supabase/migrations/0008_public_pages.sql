-- Medde — página pública do pintor para o cliente pedir orçamento.
-- Quem escreve é só o servidor (Edge Function public-page). O pintor lê as próprias linhas e cuida dos pedidos recebidos.

create table if not exists public.public_pages (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  enabled    boolean not null default true,
  snapshot   jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.public_pages enable row level security;
create policy "public_pages_select_own" on public.public_pages
  for select using (auth.uid() = user_id);

create table if not exists public.quote_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  phone      text not null,
  address    text not null default '',
  message    text not null default '',
  status     text not null default 'new' check (status in ('new', 'contacted', 'converted', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists quote_requests_user_created on public.quote_requests (user_id, created_at desc);

alter table public.quote_requests enable row level security;
-- O pintor lê, atualiza a situação e apaga só os pedidos dele. Inserir é só pela função (o cliente não tem login).
create policy "quote_requests_select_own" on public.quote_requests for select using (auth.uid() = user_id);
create policy "quote_requests_update_own" on public.quote_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quote_requests_delete_own" on public.quote_requests for delete using (auth.uid() = user_id);
