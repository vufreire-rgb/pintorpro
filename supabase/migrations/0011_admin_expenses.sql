-- Medde — painel do administrador: gastos do app lançados pelo titular (domínio, ferramentas, anúncios…).
-- RLS ligado e SEM políticas: só a Edge Function admin-stats (chave de administrador do servidor) lê e escreve.

create table if not exists public.admin_expenses (
  id           uuid primary key default gen_random_uuid(),
  day          date not null default current_date,
  description  text not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at   timestamptz not null default now()
);

alter table public.admin_expenses enable row level security;

-- Faz a API enxergar a tabela nova na hora.
notify pgrst, 'reload schema';
