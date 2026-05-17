-- Cola de trabajos de impresión para etiquetas térmicas (Munbyn) y otros
-- documentos físicos. La aplicación inserta filas aquí; un agente local
-- corriendo en el PC al que está conectada la impresora se suscribe vía
-- Supabase Realtime, descarga el PDF y lo manda al spooler del sistema.

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  label_url text not null,
  -- Etiqueta de la impresora física (nombre de spooler de Windows o CUPS).
  -- Si es null, el agente usa su impresora por defecto.
  printer_label text,
  status text not null default 'pending'
    check (status in ('pending', 'printing', 'printed', 'error')),
  error_message text,
  -- Trazabilidad: de dónde viene el job (manual, shipping_info, etc.).
  source_kind text,
  source_id uuid,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create index if not exists label_print_jobs_status_idx
  on public.label_print_jobs (status, created_at desc);

alter table public.label_print_jobs enable row level security;

drop policy if exists "label_print_jobs_auth_all" on public.label_print_jobs;
create policy "label_print_jobs_auth_all"
  on public.label_print_jobs for all to authenticated
  using (true) with check (true);

-- Habilitar Realtime para que el agente local reciba INSERTs en tiempo real.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'label_print_jobs'
  ) then
    alter publication supabase_realtime add table public.label_print_jobs;
  end if;
end $$;
