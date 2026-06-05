-- El status 'finished' (Terminados) se añadió en el código (commit 4f8832b) pero
-- el CHECK constraint de leads.status nunca se actualizó, así que marcar un lead
-- como terminado fallaba silenciosamente y el lead se quedaba en 'paid'.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['new', 'contacted', 'quoted', 'won', 'paid', 'finished', 'lost']));
