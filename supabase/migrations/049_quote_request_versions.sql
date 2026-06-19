-- Versionado de presupuestos: un lead puede tener varias revisiones del
-- presupuesto guardadas en el tiempo. Cada versión es una fila propia de
-- quote_requests (arrastra su propia proforma de Holded, token y enlace de
-- pago), y exactamente una está marcada como "vigente" (is_current) por lead.
--
-- Antes de esto el código asumía "un presupuesto por lead" leyendo siempre el
-- más reciente por fecha. Ahora ese criterio pasa a ser is_current = true.

alter table public.quote_requests
  add column if not exists version_number integer not null default 1,
  add column if not exists is_current boolean not null default true,
  add column if not exists version_label text;

-- Backfill: para cada lead, la fila más reciente queda como vigente (v1) y el
-- resto (si las hubiera por flujos antiguos como repeat orders) deja de serlo.
-- Numeramos por orden de creación dentro de cada lead.
with ranked as (
  select
    id,
    row_number() over (partition by lead_id order by created_at asc)  as asc_num,
    row_number() over (partition by lead_id order by created_at desc) as desc_num
  from public.quote_requests
  where lead_id is not null
)
update public.quote_requests qr
set
  version_number = ranked.asc_num,
  is_current     = (ranked.desc_num = 1)
from ranked
where qr.id = ranked.id;

-- Garantiza una única versión vigente por lead. Índice parcial: solo aplica a
-- las filas con is_current = true, así no choca entre leads distintos.
create unique index if not exists quote_requests_one_current_per_lead
  on public.quote_requests (lead_id)
  where is_current = true;

-- Listado del historial de versiones de un lead (panel del CRM).
create index if not exists quote_requests_lead_version_idx
  on public.quote_requests (lead_id, version_number desc);
