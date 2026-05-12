-- Notas comerciales (remarks) por lead: texto libre + fotos.
-- Pensado para que el comercial guarde rápido lo que ha hablado con el cliente
-- y referencias visuales (estilo corporativo, deportivo, lujo, etc).

create table if not exists public.lead_remarks (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  content     text,
  photo_paths text[] not null default '{}',
  created_by  uuid references public.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists lead_remarks_lead_id_idx
  on public.lead_remarks (lead_id, created_at desc);

alter table public.lead_remarks enable row level security;

drop policy if exists "employees_read_lead_remarks" on public.lead_remarks;
create policy "employees_read_lead_remarks"
  on public.lead_remarks for select
  to authenticated
  using ((select is_user_active()) = true);

drop policy if exists "managers_all_lead_remarks" on public.lead_remarks;
create policy "managers_all_lead_remarks"
  on public.lead_remarks for all
  to authenticated
  using ((select get_user_role()) = any (array['manager','admin','super_admin']))
  with check ((select get_user_role()) = any (array['manager','admin','super_admin']));

-- Bucket privado para las fotos de las remarks (acceso vía route handler).
insert into storage.buckets (id, name, public)
values ('lead-remarks', 'lead-remarks', false)
on conflict (id) do nothing;

drop policy if exists "lead remarks read auth" on storage.objects;
create policy "lead remarks read auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lead-remarks');

drop policy if exists "lead remarks insert auth" on storage.objects;
create policy "lead remarks insert auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lead-remarks');

drop policy if exists "lead remarks update auth" on storage.objects;
create policy "lead remarks update auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'lead-remarks');

drop policy if exists "lead remarks delete auth" on storage.objects;
create policy "lead remarks delete auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lead-remarks');
