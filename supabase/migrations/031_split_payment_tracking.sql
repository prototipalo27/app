-- Granular tracking for 50/50 split payments.
-- Hasta ahora `paid_amount` + `paid_at` agregaban un único pago. Para que el
-- cashflow distinga "depósito cobrado, falta entrega" de "todo cobrado" y para
-- poder enviar un recordatorio del segundo 50% antes del envío, separamos los
-- dos tramos en columnas independientes (first_* y second_*). Los campos
-- legacy se mantienen como totales agregados (compatibilidad con webhook
-- viejo, Holded reconciliation, etc.).

alter table public.quote_requests
  add column if not exists first_paid_amount numeric(10, 2),
  add column if not exists first_paid_at timestamptz,
  add column if not exists first_stripe_session_id text,
  add column if not exists first_stripe_fee_amount numeric(10, 2),
  add column if not exists second_paid_amount numeric(10, 2),
  add column if not exists second_paid_at timestamptz,
  add column if not exists second_stripe_session_id text,
  add column if not exists second_stripe_fee_amount numeric(10, 2),
  add column if not exists second_payment_requested_at timestamptz,
  add column if not exists second_holded_proforma_id text,
  add column if not exists second_holded_proforma_doc_number text;

comment on column public.quote_requests.first_paid_amount is
  'EUR del primer tramo (50% en split, 100% en full). Se rellena al confirmar el pago.';
comment on column public.quote_requests.second_paid_amount is
  'EUR del segundo tramo (50% restante en split). Null si todavía no se ha cobrado.';
comment on column public.quote_requests.second_payment_requested_at is
  'Fecha en la que el operador disparó el email de solicitud del segundo pago.';
comment on column public.quote_requests.second_holded_proforma_doc_number is
  'Doc number de la proforma generada para el segundo 50% — referencia de transferencia.';

-- Backfill: pagos previos quedan registrados en first_* (eran siempre el
-- único pago, ya fuese full o split). Solo si payment_status='paid'.
update public.quote_requests
set
  first_paid_amount = coalesce(first_paid_amount, paid_amount),
  first_paid_at = coalesce(first_paid_at, paid_at),
  first_stripe_session_id = coalesce(first_stripe_session_id, stripe_checkout_session_id),
  first_stripe_fee_amount = coalesce(first_stripe_fee_amount, stripe_fee_amount)
where payment_status = 'paid'
  and first_paid_amount is null;

create index if not exists idx_quote_requests_second_proforma_doc_number
  on public.quote_requests (second_holded_proforma_doc_number)
  where second_holded_proforma_doc_number is not null;
