-- Sincronización bidireccional entre el cierre de un proyecto y el de su lead.
--
-- Modelo: cada proyecto se corresponde 1:1 con un lead (projects.lead_id). La
-- fase "Terminados" (leads.status='finished') == proyecto "Delivered": el
-- proceso está cerrado, entregado y pagado. Al cerrar uno, se cierra el otro.
--
-- Se implementa con triggers (no en las server actions) para cubrir TODAS las
-- vías por las que cambia el estado: acciones de servidor, drag&drop del kanban
-- y jobs automáticos (auto-complete-jobs, auto-track-jobs, etc.).
--
-- SECURITY DEFINER: la sincronización corre con permisos del owner para no
-- depender del rol/RLS del usuario que dispara el cambio (p. ej. un operario
-- que entrega un proyecto pero no puede editar leads directamente).
--
-- Anti-bucle: cada trigger solo actúa sobre filas cuyo estado AÚN no es el
-- destino (status <> 'finished' / status <> 'delivered'). Cuando la cascada
-- vuelve, la fila ya está en destino → 0 filas afectadas → el trigger no se
-- vuelve a disparar y la recursión termina.

-- ── Proyecto → Delivered  ⇒  su lead → Terminados ──────────────────────────
create or replace function sync_lead_finished_on_project_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and new.status is distinct from old.status
     and new.lead_id is not null then
    update leads
       set status = 'finished'
     where id = new.lead_id
       and status <> 'finished';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_lead_finished on projects;
create trigger trg_sync_lead_finished
  after update of status on projects
  for each row
  execute function sync_lead_finished_on_project_delivered();

-- ── Lead → Terminados  ⇒  todos sus proyectos → Delivered ──────────────────
create or replace function sync_projects_delivered_on_lead_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished'
     and new.status is distinct from old.status then
    update projects
       set status = 'delivered'
     where lead_id = new.id
       and status <> 'delivered';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_projects_delivered on leads;
create trigger trg_sync_projects_delivered
  after update of status on leads
  for each row
  execute function sync_projects_delivered_on_lead_finished();
