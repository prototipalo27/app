-- Google OAuth accounts for Gmail API sending (replaces app passwords)
create table if not exists public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default array['https://www.googleapis.com/auth/gmail.send'],
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_error text,
  constraint google_accounts_user_id_key unique (user_id)
);

-- RLS: users can only read/write their own row
alter table public.google_accounts enable row level security;

create policy "Users can view own google account"
  on public.google_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own google account"
  on public.google_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own google account"
  on public.google_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own google account"
  on public.google_accounts for delete
  using (auth.uid() = user_id);

-- Service role needs full access for token refresh in server actions
-- (service role bypasses RLS by default, no extra policy needed)

-- Sent emails log for traceability (and future Fase 1/2 thread tracking)
create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text,
  gmail_thread_id text,
  "to" text not null,
  cc text,
  subject text not null,
  sent_at timestamptz not null default now(),
  entity_type text, -- 'lead', 'project', 'quote', etc.
  entity_id text    -- the related entity's ID
);

alter table public.sent_emails enable row level security;

create policy "Users can view own sent emails"
  on public.sent_emails for select
  using (auth.uid() = user_id);

create policy "Users can insert own sent emails"
  on public.sent_emails for insert
  with check (auth.uid() = user_id);

-- Index for thread lookups (Fase 1)
create index if not exists idx_sent_emails_thread on public.sent_emails(gmail_thread_id);
create index if not exists idx_sent_emails_user on public.sent_emails(user_id, sent_at desc);
