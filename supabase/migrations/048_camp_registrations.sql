-- Inscripciones al campamento de impresión 3D para niños (29 jun – 3 jul).
-- Landing pública /campamento. La inserción la hace el route handler con
-- createServiceClient() (bypass RLS). Anon NO escribe ni lee directamente;
-- solo authenticated puede leer para el panel interno.
--
-- Control de plazas: máximo 6 niños. La capacidad se calcula contando las
-- inscripciones 'paid' más las 'pending' recientes (reservas en curso que aún
-- no han completado el pago de la señal).

create table if not exists public.camp_registrations (
  id                        uuid primary key default gen_random_uuid(),
  payer_name                text not null,
  payer_email               text not null,
  payer_phone               text not null,
  child_name                text not null,
  -- quiere dejar al niño hasta las 15:00 (gratis, solo informativo)
  extended_hours            boolean not null default false,
  status                    text not null default 'pending'
                              check (status in ('pending', 'paid', 'cancelled')),
  -- señal cobrada por Stripe, en céntimos (250 € restantes se pagan en efectivo)
  deposit_amount_cents      integer not null default 5000,
  stripe_payment_link_id    text,
  stripe_session_id         text,
  stripe_payment_intent_id  text,
  paid_at                   timestamptz,
  user_agent                text,
  ip_hash                   text,
  created_at                timestamptz not null default now()
);

create index if not exists camp_registrations_created_at_idx
  on public.camp_registrations (created_at desc);

create index if not exists camp_registrations_status_idx
  on public.camp_registrations (status);

alter table public.camp_registrations enable row level security;

drop policy if exists "camp_registrations_auth_read" on public.camp_registrations;
create policy "camp_registrations_auth_read"
  on public.camp_registrations for select to authenticated
  using (true);
