-- Kickoff meeting (reunión inicial con la diseñadora tras confirmar pago).
--
-- Cuando un pago se confirma, onPaymentConfirmed genera 3 huecos disponibles
-- en la agenda de Isabella (vía Google Calendar freebusy) y los guarda en el
-- proyecto, junto a un token público. El cliente recibe en el mismo email de
-- factura un link /kickoff/<token> con los 3 botones; al elegir uno, creamos
-- el evento en el calendario de Isabella con Google Meet y guardamos el
-- evento + link en el proyecto.

alter table public.projects
  add column if not exists kickoff_token text,
  add column if not exists kickoff_proposed_slots jsonb,
  add column if not exists kickoff_confirmed_slot timestamptz,
  add column if not exists kickoff_confirmed_at timestamptz,
  add column if not exists kickoff_event_id text,
  add column if not exists kickoff_meeting_link text;

-- Lookup público por token desde /kickoff/[token]
create unique index if not exists projects_kickoff_token_key
  on public.projects (kickoff_token)
  where kickoff_token is not null;
