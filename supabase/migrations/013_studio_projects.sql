-- Prototipalo Studio: proyectos premium (desarrollo de patentes, consultoría
-- de diseño…) con un ciclo de vida distinto al de los trofeos/maquetas.
-- Vive aparte de `projects` para no contaminar la cola de impresión ni el
-- pipeline rápido.

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'brief'
    check (status in ('brief', 'propuesta', 'en_curso', 'entregado', 'cerrado', 'cancelado')),

  client_name text,
  client_email text,
  holded_contact_id text,

  total_price numeric(10, 2),
  currency text not null default 'EUR',

  project_manager_id uuid references public.user_profiles(id) on delete set null,

  start_date date,
  expected_end_date date,

  -- Brief 1:1, inline para evitar joins en cada lectura.
  brief_description text,
  brief_objectives text,
  brief_constraints text,
  brief_references text,

  notes text,

  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_projects_status_idx
  on public.studio_projects (status);

create index if not exists studio_projects_pm_idx
  on public.studio_projects (project_manager_id);

create table if not exists public.studio_meetings (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  meeting_date timestamptz not null default now(),
  attendees text[] not null default '{}',
  summary text,
  action_items text,
  recording_url text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists studio_meetings_project_idx
  on public.studio_meetings (studio_project_id, meeting_date desc);

create table if not exists public.studio_payments (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'EUR',
  due_date date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'facturado', 'cobrado', 'cancelado')),
  holded_invoice_id text,
  paid_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists studio_payments_project_idx
  on public.studio_payments (studio_project_id, position);

create table if not exists public.studio_documents (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  name text not null,
  url text not null,
  kind text,
  uploaded_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists studio_documents_project_idx
  on public.studio_documents (studio_project_id, created_at desc);

-- Trigger para mantener updated_at en studio_projects
create or replace function public.studio_projects_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_projects_updated_at on public.studio_projects;
create trigger studio_projects_updated_at
  before update on public.studio_projects
  for each row execute function public.studio_projects_set_updated_at();

-- RLS: por ahora, autenticados pueden todo (mismo patrón que el resto del módulo).
alter table public.studio_projects enable row level security;
alter table public.studio_meetings enable row level security;
alter table public.studio_payments enable row level security;
alter table public.studio_documents enable row level security;

drop policy if exists "studio_projects_auth_all" on public.studio_projects;
create policy "studio_projects_auth_all"
  on public.studio_projects for all to authenticated
  using (true) with check (true);

drop policy if exists "studio_meetings_auth_all" on public.studio_meetings;
create policy "studio_meetings_auth_all"
  on public.studio_meetings for all to authenticated
  using (true) with check (true);

drop policy if exists "studio_payments_auth_all" on public.studio_payments;
create policy "studio_payments_auth_all"
  on public.studio_payments for all to authenticated
  using (true) with check (true);

drop policy if exists "studio_documents_auth_all" on public.studio_documents;
create policy "studio_documents_auth_all"
  on public.studio_documents for all to authenticated
  using (true) with check (true);
