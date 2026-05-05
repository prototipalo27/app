-- Tabla de mapeo entre proyectos y eventos del calendario compartido
-- de Google ("Prototipalo Entregas"). Un row por proyecto con los IDs
-- externos de los dos eventos que generamos: inicio de preparación y
-- entrega. Sin ellos no podríamos hacer upsert/delete idempotente.

create table if not exists public.project_calendar_events (
  project_id uuid primary key references public.projects(id) on delete cascade,
  calendar_id text not null,
  delivery_event_id text,
  prep_event_id text,
  synced_at timestamptz not null default now()
);

create index if not exists project_calendar_events_synced_at_idx
  on public.project_calendar_events(synced_at);

alter table public.project_calendar_events enable row level security;

-- Solo lectura desde la app autenticada; escrituras solo desde server
-- (service-role bypass RLS).
create policy "Authenticated users can read calendar events"
  on public.project_calendar_events
  for select
  to authenticated
  using (true);
