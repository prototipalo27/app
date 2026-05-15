-- Flag: recogida en persona. Cuando es true, el cliente vendrá a recoger
-- el proyecto y no es necesaria dirección de envío — el alert rojo del
-- kanban no debe dispararse por falta de shipping_address en estos casos.
alter table public.quote_requests
  add column if not exists pickup_in_person boolean not null default false;

comment on column public.quote_requests.pickup_in_person is
  'Si true, el cliente recoge en persona; no requiere dirección de envío.';
