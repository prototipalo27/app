-- Notas internas de "puntos de mejora" para conversar con cada empleado
-- en 1-on-1s. Solo managers/admins/super_admins las leen y escriben — el
-- propio empleado no debería verlas (son prep de manager).

create table if not exists public.employee_improvement_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.user_profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.user_profiles(id) on delete set null
);

create index if not exists employee_improvement_notes_user_idx
  on public.employee_improvement_notes (user_id, resolved_at);

alter table public.employee_improvement_notes enable row level security;

drop policy if exists "managers_all_employee_improvement_notes" on public.employee_improvement_notes;
create policy "managers_all_employee_improvement_notes"
  on public.employee_improvement_notes for all
  to authenticated
  using ((select get_user_role()) = any (array['manager','admin','super_admin']))
  with check ((select get_user_role()) = any (array['manager','admin','super_admin']));
