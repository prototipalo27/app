-- Miembros internos de un proyecto Studio: subconjunto de empleados de
-- Prototipalo (`user_profiles`) que están realmente involucrados en ese
-- proyecto. Se usa para filtrar pickers (PM, asistentes a reuniones,
-- imputación de horas) en lugar de mostrar a toda la oficina.
--
-- Migración suave: si un proyecto no tiene miembros configurados, los
-- pickers siguen mostrando a todos los empleados activos. En cuanto se
-- añade el primero, los pickers se filtran a esa lista.

create table if not exists public.studio_project_members (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (studio_project_id, user_id)
);

create index if not exists studio_project_members_project_idx
  on public.studio_project_members (studio_project_id);

create index if not exists studio_project_members_user_idx
  on public.studio_project_members (user_id);

alter table public.studio_project_members enable row level security;

drop policy if exists "studio_project_members_auth_all"
  on public.studio_project_members;
create policy "studio_project_members_auth_all"
  on public.studio_project_members for all to authenticated
  using (true) with check (true);
