-- Medde — notificações no celular (Web Push).
-- push_keys: o par de chaves do servidor, criado sozinho pela função "push" na primeira vez. Sem nenhuma política: o app nunca lê.
-- push_subscriptions: um aparelho por linha. Só a função escreve; o pintor lê as próprias linhas.

create table if not exists public.push_keys (
  id          integer primary key check (id = 1),
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);
alter table public.push_keys enable row level security;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on public.push_subscriptions for select using (auth.uid() = user_id);
