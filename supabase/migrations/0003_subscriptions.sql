-- Medde — assinatura: uma linha por usuário. Só o servidor escreve (webhooks do gateway / SQL do titular);
-- o app só LÊ a própria linha.

create table if not exists public.subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  status                   text not null default 'trial' check (status in ('trial', 'active', 'canceled')),
  trial_ends_at            timestamptz not null default (now() + interval '30 days'),
  current_period_end       timestamptz,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Cada usuário lê SÓ a própria linha. Não há política de insert/update/delete: o app não consegue se dar acesso.
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Todo usuário novo ganha 30 dias de teste a partir do cadastro.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Quem já tinha conta antes desta migração ganha 30 dias contados a partir de agora.
insert into public.subscriptions (user_id, trial_ends_at)
select id, now() + interval '30 days' from auth.users
on conflict do nothing;
