-- Persistir el número de la factura Holded en quote_requests para no tener
-- que volver a llamar a Holded en cada vista (conciliación, listados, etc.)
-- y para tener una fuente fiable de "esta factura tiene número de verdad".

alter table public.quote_requests
  add column if not exists invoice_doc_number text;
