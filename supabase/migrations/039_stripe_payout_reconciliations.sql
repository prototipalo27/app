-- Marca qué payouts de Stripe ya están conciliados contra el extracto BBVA.
-- Solo guardamos el estado de "ya cuadrado" — toda la metadata viene live
-- desde la API de Stripe en la página de conciliación.

create table if not exists public.stripe_payout_reconciliations (
  payout_id text primary key,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid references public.user_profiles(id) on delete set null,
  notes text
);

alter table public.stripe_payout_reconciliations enable row level security;

drop policy if exists "managers_all_payout_reconciliations" on public.stripe_payout_reconciliations;
create policy "managers_all_payout_reconciliations"
  on public.stripe_payout_reconciliations for all
  to authenticated
  using ((select get_user_role()) = any (array['manager','admin','super_admin']))
  with check ((select get_user_role()) = any (array['manager','admin','super_admin']));
