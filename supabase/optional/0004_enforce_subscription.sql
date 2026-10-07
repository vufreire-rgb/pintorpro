-- OPCIONAL — NÃO aplicar antes de testar a assinatura de ponta a ponta (docs/ASSINATURA.md).
-- Faz o BANCO recusar gravações de quem está bloqueado (a tela de bloqueio do app sozinha pode ser contornada).
-- Só gravações são barradas: ler os próprios dados continua liberado (exportar e excluir conta continuam funcionando).
-- Regra idêntica à do app: acesso até o fim do período + 3 dias.

create or replace function public.has_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
              when s.status = 'trial' then now() < s.trial_ends_at + interval '3 days'
              when s.current_period_end is null then true
              else now() < s.current_period_end + interval '3 days'
            end
       from public.subscriptions s where s.user_id = uid),
    true  -- sem linha de assinatura: não bloqueia (falha aberta)
  );
$$;

drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert with check (auth.uid() = user_id and public.has_access(auth.uid()));
create policy "user_data_update_own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_access(auth.uid()));

-- Para desfazer: rode de novo as políticas de supabase/migrations/0001_user_data.sql.
