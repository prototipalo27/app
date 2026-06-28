-- Coach virtual por WhatsApp: registro de check-ins del mentor.
-- Solo se accede desde el servidor con la service-role key (que omite RLS),
-- por eso habilitamos RLS sin políticas públicas: queda bloqueado para
-- anon/authenticated y abierto únicamente para la service role.

create table if not exists mentor_checkins (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('diario','semanal','mensual')),
  salud_ok boolean,
  social_ok boolean,
  empresa_ok boolean,
  excusa text,
  win text,
  nota_mentor text,
  created_at timestamptz default now()
);

create index if not exists mentor_checkins_created_at_idx
  on mentor_checkins (created_at desc);

alter table mentor_checkins enable row level security;
