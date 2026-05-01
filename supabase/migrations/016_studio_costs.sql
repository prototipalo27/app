-- Tracking interno de costes para proyectos Studio: gastos directos y
-- horas imputadas por miembro del equipo. NO se expone al portal del
-- cliente — vive solo en el dashboard interno.

create table if not exists public.studio_expenses (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  concept text not null,
  amount numeric(10, 2) not null,
  expense_date date not null default current_date,
  category text,
  supplier text,
  notes text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists studio_expenses_project_idx
  on public.studio_expenses (studio_project_id, expense_date desc);

create table if not exists public.studio_time_entries (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  -- Snapshot del nombre por si el usuario se borra o cambia.
  user_label text,
  work_date date not null default current_date,
  hours numeric(5, 2) not null check (hours > 0),
  description text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists studio_time_entries_project_idx
  on public.studio_time_entries (studio_project_id, work_date desc);

alter table public.studio_expenses enable row level security;
alter table public.studio_time_entries enable row level security;

drop policy if exists "studio_expenses_auth_all" on public.studio_expenses;
create policy "studio_expenses_auth_all"
  on public.studio_expenses for all to authenticated
  using (true) with check (true);

drop policy if exists "studio_time_entries_auth_all" on public.studio_time_entries;
create policy "studio_time_entries_auth_all"
  on public.studio_time_entries for all to authenticated
  using (true) with check (true);
