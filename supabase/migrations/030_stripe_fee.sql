-- Comisión de Stripe asociada a un cobro vía Stripe. Se persiste para
-- reconciliar contra el ingreso neto que llega al banco (BBVA recibe
-- total − comisión ~3 días después). El cliente sigue debiendo el total;
-- la comisión es gasto interno y NO se descuenta de la factura Holded.
alter table public.quote_requests
  add column if not exists stripe_fee_amount numeric(10, 2);

comment on column public.quote_requests.stripe_fee_amount is
  'Stripe fee in EUR for this payment. Net received = paid_amount - stripe_fee_amount.';
