-- Facturas de transportista (resumen mensual de MRW) importadas para imputar
-- el coste de envío a cada proyecto y poder calcular márgenes.
--
-- El coste de cada línea (un albarán) se imputa a shipping_info.price del envío
-- correspondiente — el mismo campo que ya rellena Packlink — de modo que aparece
-- automáticamente en el reporte financiero y en el margen del proyecto, sin
-- duplicar modelos. Esta tabla guarda la CABECERA de cada factura para
-- auditoría, histórico y para evitar reimportar dos veces la misma.

create table if not exists public.carrier_invoices (
  id                uuid primary key default gen_random_uuid(),
  carrier           text not null default 'MRW',
  invoice_number    text not null,
  invoice_date      date,
  period            text,               -- "2026-06"
  cost_center       text,               -- código de centro de coste (050645)
  lines_amount      numeric,            -- suma de líneas de envío (227.46)
  surcharge_amount  numeric,            -- recargos: combustible + seguro (35.19)
  gross_amount      numeric,            -- base imponible total (263.65)
  tax_amount        numeric,            -- IVA (55.37)
  total_amount      numeric,            -- total factura (319.02)
  line_count        integer not null default 0,
  matched_count     integer not null default 0,
  -- líneas parseadas + asignación final aplicada (para auditoría/reapertura)
  parsed            jsonb,
  applied_at        timestamptz,
  uploaded_by       uuid references public.user_profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (carrier, invoice_number)
);

alter table public.carrier_invoices enable row level security;

drop policy if exists "managers_all_carrier_invoices" on public.carrier_invoices;
create policy "managers_all_carrier_invoices"
  on public.carrier_invoices for all
  to authenticated
  using ((select get_user_role()) = any (array['manager','admin','super_admin']))
  with check ((select get_user_role()) = any (array['manager','admin','super_admin']));

-- Enlaza cada envío al import que fijó su coste, y marca el origen del coste
-- (imputado desde factura MRW vs. precio de etiqueta de Packlink/GLS). Permite
-- reimportar una factura de forma idempotente (localizar sus líneas anteriores).
alter table public.shipping_info
  add column if not exists carrier_invoice_id uuid
    references public.carrier_invoices(id) on delete set null,
  add column if not exists cost_source text;   -- 'mrw_invoice' | 'packlink' | 'manual'

-- Una recogida (p. ej. GRECA, remitente) no es una entrega a cliente pero sí es
-- un coste imputable a un proyecto: ampliamos el tipo de envío con 'pickup'.
alter table public.shipping_info
  drop constraint if exists shipping_info_shipment_kind_check;
alter table public.shipping_info
  add constraint shipping_info_shipment_kind_check
  check (shipment_kind in ('sample', 'partial', 'final', 'pickup'));

create index if not exists shipping_info_carrier_invoice_idx
  on public.shipping_info (carrier_invoice_id);

-- El casado de líneas de factura ↔ envíos se hace por número de albarán MRW.
create index if not exists shipping_info_mrw_albaran_idx
  on public.shipping_info (mrw_albaran)
  where mrw_albaran is not null;
