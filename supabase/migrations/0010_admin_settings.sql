-- Medde — painel do administrador: ajustes digitados pelo titular (meta, imposto, custos fixos). Uma única linha.
-- RLS ligado e SEM políticas: só a Edge Function admin-stats (chave de administrador do servidor) lê e escreve.

create table if not exists public.admin_settings (
  id                 integer primary key default 1 check (id = 1),
  goal_subscribers   integer not null default 100,
  goal_date          date,
  tax_pct            numeric not null default 6,
  fixed_cost_cents   integer not null default 0,
  voice_cost_cents   integer not null default 10,
  receipt_cost_cents integer not null default 2,
  updated_at         timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

insert into public.admin_settings (id) values (1) on conflict do nothing;
