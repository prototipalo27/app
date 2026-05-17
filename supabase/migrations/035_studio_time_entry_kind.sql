-- Distinguir horas de ingeniería ("engineering") de horas de máquina de
-- impresión ("print") para llevar contabilidad de recursos. Lo que se
-- vende a los clientes son bolsas mensuales de cada tipo (p. ej. 50 h
-- de ingeniería + 50 h de impresión), así que necesitamos contarlas
-- por separado en la pestaña Costes.

alter table public.studio_time_entries
  add column if not exists kind text not null default 'engineering';

alter table public.studio_time_entries
  drop constraint if exists studio_time_entries_kind_check;

alter table public.studio_time_entries
  add constraint studio_time_entries_kind_check
  check (kind in ('engineering', 'print'));

create index if not exists studio_time_entries_project_kind_idx
  on public.studio_time_entries (studio_project_id, kind);
