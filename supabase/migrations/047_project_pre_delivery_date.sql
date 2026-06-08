-- Dos fechas de entrega por proyecto:
--   - deadline (ya existente)  → entrega FINAL.
--   - pre_delivery_date (nueva) → pre-entrega / muestra.
-- Y un flag para marcar la entrega final como compromiso firme / evento, para
-- resaltarla en el tablero.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pre_delivery_date date,
  ADD COLUMN IF NOT EXISTS deadline_is_hard boolean NOT NULL DEFAULT false;
