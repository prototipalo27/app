-- Colaboradores de proyectos Studio: el cliente y sus stakeholders (founder,
-- abogado, CFO…) entran al portal `/studio-portal/[token]` con su propio
-- token. Cada uno ve solo las secciones que el equipo de Prototipalo ha
-- habilitado para esa invitación.

create table if not exists public.studio_project_collaborators (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  email text not null,
  name text,

  -- Token largo (32 chars hex) que actúa de credencial: el link se puede
  -- guardar en favoritos del navegador y entrar sin password.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  can_see_brief boolean not null default true,
  can_see_meetings boolean not null default false,
  can_see_payments boolean not null default true,
  can_see_documents boolean not null default true,

  last_viewed_at timestamptz,

  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (studio_project_id, email)
);

create index if not exists studio_project_collaborators_project_idx
  on public.studio_project_collaborators (studio_project_id);

create index if not exists studio_project_collaborators_token_idx
  on public.studio_project_collaborators (token);

alter table public.studio_project_collaborators enable row level security;

drop policy if exists "studio_project_collaborators_auth_all"
  on public.studio_project_collaborators;
create policy "studio_project_collaborators_auth_all"
  on public.studio_project_collaborators for all to authenticated
  using (true) with check (true);

-- El portal cliente (`/studio-portal/[token]`) lee con el SERVICE ROLE en
-- server components, filtrando por token explícitamente — mismo patrón
-- que `/track/[token]`. No hay policy abierta a `anon`: solo los
-- authenticated del equipo y el service role pueden tocar esta tabla.
