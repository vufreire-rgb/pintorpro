-- Medde — o cliente toca em "Fechar agora" no link do orçamento: guardamos quando e quais ambientes ele escolheu.
-- Só a função quote-link escreve. O pintor lê (já tem política de leitura em shared_quotes). Sem isto o aviso no celular funciona,
-- mas o app do pintor não mostra "cliente pediu para fechar".

alter table public.shared_quotes add column if not exists accepted_at timestamptz;
alter table public.shared_quotes add column if not exists accepted_rooms jsonb;
alter table public.shared_quotes add column if not exists accepted_total_cents integer;

notify pgrst, 'reload schema';
