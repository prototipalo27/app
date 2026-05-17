-- Drive folder per lead + Supabase Storage buffer for attachments that arrive
-- before the lead is qualified (i.e. still in status='new'). On qualification,
-- the buffered files are flushed into the lead's Drive folder; on project
-- conversion, the lead folder is renamed and moved into the client folder.

alter table public.leads
  add column if not exists google_drive_folder_id text;

create table if not exists public.lead_attachments (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references public.leads(id) on delete cascade,
  source            text not null check (source in ('email','webflow','manual')),
  filename          text not null,
  mime_type         text not null,
  storage_path      text not null,
  gmail_message_id  text,
  created_at        timestamptz not null default now()
);

create index if not exists lead_attachments_lead_id_idx
  on public.lead_attachments (lead_id, created_at desc);

alter table public.lead_attachments enable row level security;

drop policy if exists "employees_read_lead_attachments" on public.lead_attachments;
create policy "employees_read_lead_attachments"
  on public.lead_attachments for select
  to authenticated
  using ((select is_user_active()) = true);

drop policy if exists "managers_all_lead_attachments" on public.lead_attachments;
create policy "managers_all_lead_attachments"
  on public.lead_attachments for all
  to authenticated
  using ((select get_user_role()) = any (array['manager','admin','super_admin']))
  with check ((select get_user_role()) = any (array['manager','admin','super_admin']));

-- Private bucket: the webhook writes via service_role, the CRM reads via
-- route handlers that re-stream the file with the user's auth.
insert into storage.buckets (id, name, public)
values ('lead-attachments', 'lead-attachments', false)
on conflict (id) do nothing;

drop policy if exists "lead attachments read auth" on storage.objects;
create policy "lead attachments read auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lead-attachments');

drop policy if exists "lead attachments insert auth" on storage.objects;
create policy "lead attachments insert auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lead-attachments');

drop policy if exists "lead attachments update auth" on storage.objects;
create policy "lead attachments update auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'lead-attachments');

drop policy if exists "lead attachments delete auth" on storage.objects;
create policy "lead attachments delete auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lead-attachments');
