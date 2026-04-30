-- QC photos bucket + client pre-shipping confirmation

-- 1. Client confirmation columns on projects
alter table public.projects
  add column if not exists client_confirmed_at timestamptz,
  add column if not exists client_confirmed_by text;

-- 2. Storage bucket for QC photos (private; access via authenticated dashboard or signed URLs from server)
insert into storage.buckets (id, name, public)
values ('qc-photos', 'qc-photos', false)
on conflict (id) do nothing;

-- Authenticated users (workshop staff) can read/write QC photos
drop policy if exists "qc photos read auth" on storage.objects;
create policy "qc photos read auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'qc-photos');

drop policy if exists "qc photos insert auth" on storage.objects;
create policy "qc photos insert auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'qc-photos');

drop policy if exists "qc photos update auth" on storage.objects;
create policy "qc photos update auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'qc-photos');

drop policy if exists "qc photos delete auth" on storage.objects;
create policy "qc photos delete auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'qc-photos');
