-- Calendario de entregas: horas laborales que se reservan antes de la
-- fecha de entrega para preparar el proyecto. 48h por defecto (~6 días
-- laborales con jornada de 8h). Editable desde /dashboard/entregas.
-- Vive en app_metadata porque es un setting global de empresa, no por
-- usuario — el calendario es compartido.

insert into public.app_metadata (key, value)
values ('delivery_lead_hours', '48')
on conflict (key) do nothing;
