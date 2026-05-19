-- El bucket mrw-labels existe (público) pero no tenía RLS policies para
-- escritura, así que las subidas desde server actions/route handlers
-- caían con "new row violates row level security policy". Replicamos
-- exactamente las policies que ya hay en gls-labels.

drop policy if exists "Allow authenticated upload mrw-labels" on storage.objects;
create policy "Allow authenticated upload mrw-labels"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mrw-labels');

drop policy if exists "Allow authenticated update mrw-labels" on storage.objects;
create policy "Allow authenticated update mrw-labels"
  on storage.objects for update to authenticated
  using (bucket_id = 'mrw-labels');

drop policy if exists "Allow public read mrw-labels" on storage.objects;
create policy "Allow public read mrw-labels"
  on storage.objects for select to public
  using (bucket_id = 'mrw-labels');
