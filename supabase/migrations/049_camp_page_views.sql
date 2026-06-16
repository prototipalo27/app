-- Contador de visitas a la landing pública /campamento. Cada visita la
-- registra un beacon de cliente vía /api/campamento/view con createServiceClient()
-- (bypass RLS). Anon NO escribe ni lee directamente; solo authenticated lee
-- para las estadísticas del panel interno.

create table if not exists public.camp_page_views (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text,
  user_agent  text,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists camp_page_views_created_at_idx
  on public.camp_page_views (created_at desc);

alter table public.camp_page_views enable row level security;

drop policy if exists "camp_page_views_auth_read" on public.camp_page_views;
create policy "camp_page_views_auth_read"
  on public.camp_page_views for select to authenticated
  using (true);
