-- Contrato de Desarrollo y Colaboración (Development Agreement) para
-- proyectos Studio. Mismo flujo que el NDA: el cliente lo firma online
-- en /contract/[token]. Tabla aparte porque el ciclo de vida y los
-- campos son distintos (snapshot de términos económicos, idioma, etc.).

-- ── Términos económicos editables por proyecto ─────────────────
-- Defaults reflejan el modelo estándar de Prototipalo Studio recogido
-- en el Anexo A del contrato (€250 espacio, 50h ingeniería @ €60, 50h
-- impresión @ €5, 3 meses mínimo, umbral aprobación €300).

alter table public.studio_projects
  add column if not exists dev_agreement_workspace_fee numeric(10, 2) not null default 250,
  add column if not exists dev_agreement_engineering_hours integer not null default 50,
  add column if not exists dev_agreement_engineering_rate numeric(10, 2) not null default 60,
  add column if not exists dev_agreement_printing_hours integer not null default 50,
  add column if not exists dev_agreement_printing_rate numeric(10, 2) not null default 5,
  add column if not exists dev_agreement_minimum_months integer not null default 3,
  add column if not exists dev_agreement_approval_threshold numeric(10, 2) not null default 300;

-- ── Idioma del NDA (para alinear con el contrato y permitir toggle) ─
-- Solo aplica al NDA de Studio; los NDAs de leads se quedan implícitos
-- en español (su plantilla es ES-only).

alter table public.nda_agreements
  add column if not exists language text not null default 'en'
  check (language in ('es', 'en'));

-- ── Tabla del contrato de desarrollo ────────────────────────────

create table if not exists public.studio_dev_agreements (
  id uuid primary key default gen_random_uuid(),
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'signed', 'cancelled')),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Idioma elegido al enviar; determina la plantilla mostrada al firmar.
  language text not null default 'en'
    check (language in ('es', 'en')),

  -- Datos del firmante (rellenados por el cliente al firmar).
  signer_name text,
  signer_company text,
  signer_nif text,
  signer_address text,
  signer_email text,
  signer_position text,

  signature_data text,
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,

  -- Snapshot de los términos económicos vigentes al enviar el contrato.
  -- Quedan congelados en el documento aunque el manager edite los valores
  -- en studio_projects más adelante.
  workspace_fee numeric(10, 2) not null,
  engineering_hours integer not null,
  engineering_rate numeric(10, 2) not null,
  printing_hours integer not null,
  printing_rate numeric(10, 2) not null,
  minimum_months integer not null,
  approval_threshold numeric(10, 2) not null,

  -- Fecha del NDA al que el contrato hace referencia (Recital III).
  -- Se autocompleta del NDA firmado del proyecto.
  nda_reference_date date,

  sent_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_dev_agreements_project_idx
  on public.studio_dev_agreements (studio_project_id);

create index if not exists studio_dev_agreements_status_idx
  on public.studio_dev_agreements (status);

create unique index if not exists studio_dev_agreements_token_idx
  on public.studio_dev_agreements (token);
