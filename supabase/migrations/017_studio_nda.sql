-- Reusamos la tabla nda_agreements existente (la de leads) añadiendo un
-- segundo puntero opcional a studio_projects. Cada NDA pertenece a UNO
-- de los dos contextos — nunca a ambos.

alter table public.nda_agreements
  add column if not exists studio_project_id uuid
  references public.studio_projects(id) on delete cascade;

create index if not exists nda_agreements_studio_project_idx
  on public.nda_agreements (studio_project_id);

-- lead_id pasa a ser opcional para permitir NDAs ligados solo a Studio.
alter table public.nda_agreements
  alter column lead_id drop not null;

-- Garantía: exactamente uno de los dos punteros está relleno.
alter table public.nda_agreements
  drop constraint if exists nda_agreements_owner_check;

alter table public.nda_agreements
  add constraint nda_agreements_owner_check
  check (
    (lead_id is not null and studio_project_id is null)
    or (lead_id is null and studio_project_id is not null)
  );
