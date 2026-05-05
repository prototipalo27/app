-- Calendario de entregas: horas laborales que se reservan antes de la
-- fecha de entrega para preparar el proyecto. 48h por defecto = 2 días
-- laborales (24h por día, saltando fines de semana y festivos).
-- Editable desde /dashboard/entregas.
-- Vive en app_metadata porque es un setting global de empresa, no por
-- usuario — el calendario es compartido.

insert into public.app_metadata (key, value)
values ('delivery_lead_hours', '48')
on conflict (key) do nothing;
