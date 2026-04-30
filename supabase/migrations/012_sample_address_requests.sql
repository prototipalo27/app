-- Sample address requests: ask a lead to fill in their shipping address
-- before we send a physical sample.

create table if not exists public.sample_address_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'shipped', 'cancelled')),
  sent_by uuid references public.user_profiles(id) on delete set null,

  recipient_name text,
  recipient_phone text,
  recipient_email text,

  street text,
  city text,
  postal_code text,
  province text,
  country text,

  notes text,

  submitted_at timestamptz,
  shipping_info_id uuid references public.shipping_info(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sample_address_requests_lead_id_idx
  on public.sample_address_requests (lead_id);

create index if not exists sample_address_requests_token_idx
  on public.sample_address_requests (token);

alter table public.sample_address_requests enable row level security;

drop policy if exists "sample_address_requests_auth_all" on public.sample_address_requests;
create policy "sample_address_requests_auth_all"
  on public.sample_address_requests
  for all
  to authenticated
  using (true)
  with check (true);
