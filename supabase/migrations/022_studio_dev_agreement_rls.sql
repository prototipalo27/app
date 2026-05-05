-- RLS para studio_dev_agreements: misma política que el resto del módulo
-- Studio (authenticated puede todo). El service role bypassea RLS por sí
-- solo, así que no necesita policy explícita — la página pública de firma
-- (`/contract/[token]`) usa createServiceClient() y por tanto entra sin RLS.

alter table public.studio_dev_agreements enable row level security;

drop policy if exists "studio_dev_agreements_auth_all" on public.studio_dev_agreements;
create policy "studio_dev_agreements_auth_all"
  on public.studio_dev_agreements for all to authenticated
  using (true) with check (true);
