-- Medde — orçamento por voz: contador diário por usuário (limite de uso, protege o custo da IA).
-- Só o servidor (Edge Function voice-quote) lê e escreve. O app não tem acesso.

create table if not exists public.voice_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

-- RLS ligado e SEM políticas: ninguém pelo app lê ou escreve; a função usa a chave de administrador do servidor.
alter table public.voice_usage enable row level security;
