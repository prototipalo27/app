-- Soporte para "items extras" (ampliaciones) en proyectos ya facturados.
-- Caso típico: vendemos 15 trofeos, el cliente quiere 5 más en el mismo
-- batch. Los 5 extras se añaden como filas en project_items con sus
-- propios datos de facturación, sin tocar la factura/proforma original.
--
-- payment_option en projects: hoy vive solo en quote_requests, lo
-- propagamos a projects para no tener que hacer un join cada vez que
-- queramos saber el esquema de pago del proyecto.

alter table public.project_items
  add column if not exists holded_proforma_id text,
  add column if not exists holded_invoice_id text,
  add column if not exists unit_price numeric(10, 2),
  add column if not exists is_addon boolean not null default false,
  add column if not exists addon_status text
    check (addon_status is null or addon_status in (
      'pending_payment',           -- full case: esperando pago Stripe del 100%
      'pending_second_invoice',    -- split case: se cobrará en el 2º pago
      'paid'
    )),
  add column if not exists addon_stripe_session_id text,
  add column if not exists added_at timestamptz default now();

create index if not exists project_items_addon_session_idx
  on public.project_items(addon_stripe_session_id)
  where addon_stripe_session_id is not null;

alter table public.projects
  add column if not exists payment_option text
    check (payment_option is null or payment_option in ('full', 'split'));

-- Backfill: copiar payment_option desde el quote_request asociado al lead.
-- Si un lead tiene varios quote_requests cogemos el último confirmado.
update public.projects p
set payment_option = sub.payment_option
from (
  select distinct on (lead_id) lead_id, payment_option
  from public.quote_requests
  where payment_option is not null
  order by lead_id, created_at desc
) sub
where p.lead_id = sub.lead_id
  and p.payment_option is null;
