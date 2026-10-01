-- Pasta privada para fotos e áudios das visitas. Cada usuário só acessa a própria pasta (<user_id>/...).
insert into storage.buckets (id, name, public)
values ('visit-files', 'visit-files', false)
on conflict (id) do nothing;

create policy "visit_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'visit-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "visit_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'visit-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "visit_files_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'visit-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "visit_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'visit-files' and (storage.foldername(name))[1] = auth.uid()::text);
