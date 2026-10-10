-- Medde — ditado nos campos de texto (transcrição): contador diário por usuário (limite de uso, protege o custo da IA).
-- Só o servidor (Edge Function voice-quote, modo "transcribe") lê e escreve. O app não tem acesso.

create table if not exists public.dictation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.dictation_usage enable row level security;

notify pgrst, 'reload schema';
