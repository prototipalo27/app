-- Captación de emails desde la landing pública /eventos (QR en eventos/ferias).
-- La inserción la hace el route handler con createServiceClient() (bypass RLS).
-- Anon NO debe poder leer ni escribir directamente; solo authenticated lee.

create table if not exists public.event_leads (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  unique (email)
);

create index if not exists event_leads_created_at_idx
  on public.event_leads (created_at desc);

create index if not exists event_leads_source_idx
  on public.event_leads (source)
  where source is not null;

alter table public.event_leads enable row level security;

drop policy if exists "event_leads_auth_read" on public.event_leads;
create policy "event_leads_auth_read"
  on public.event_leads for select to authenticated
  using (true);
