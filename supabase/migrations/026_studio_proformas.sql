-- Studio proformas: cobro a hitos via Holded + Stripe.
-- 1) Añadimos datos de facturación (incluido tax_rate por proyecto) a studio_projects
--    para auto-crear el contacto Holded sin pedir nada al cliente.
-- 2) Añadimos campos de proforma + tracking público a studio_payments para que
--    cada hito pueda generar su propia proforma y enlace de pago.

-- ── studio_projects: datos de facturación ─────────────────────────────
alter table public.studio_projects
  add column if not exists tax_rate numeric(5, 2) not null default 21,
  add column if not exists client_company_name text,
  add column if not exists client_tax_id text,
  add column if not exists client_address text,
  add column if not exists client_city text,
  add column if not exists client_postal_code text,
  add column if not exists client_country text,
  add column if not exists client_country_code text,
  add column if not exists client_representative text;

comment on column public.studio_projects.tax_rate is
  'IVA aplicable al cliente (0 para fuera de la UE como Suiza, 21 por defecto).';

-- ── studio_payments: ciclo de proforma + cobro online ─────────────────
alter table public.studio_payments
  add column if not exists holded_proforma_id text,
  add column if not exists holded_proforma_doc_number text,
  add column if not exists tracking_token uuid not null default gen_random_uuid(),
  add column if not exists proforma_sent_at timestamptz,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_status text;

create unique index if not exists studio_payments_tracking_token_uidx
  on public.studio_payments (tracking_token);

create index if not exists studio_payments_holded_proforma_idx
  on public.studio_payments (holded_proforma_id);
