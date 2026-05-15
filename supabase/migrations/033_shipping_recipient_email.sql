-- Email de contacto del destinatario del envío. Lo usamos para confirmar
-- preparación / track de envío con el destinatario final, que no siempre
-- coincide con el contacto del lead (p. ej. logística del cliente).
alter table public.quote_requests
  add column if not exists shipping_recipient_email text;
