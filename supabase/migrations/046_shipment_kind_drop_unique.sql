-- Ahora que el código ya no hace upsert sobre project_id (reutiliza la fila
-- 'final' del proyecto), retiramos el UNIQUE(project_id) para permitir varias
-- pre-entregas (muestras / entregas parciales) por proyecto.
--
-- Mantenemos la invariante "como mucho UNA entrega final por proyecto" con un
-- índice único parcial.
ALTER TABLE shipping_info DROP CONSTRAINT IF EXISTS shipping_info_project_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS shipping_info_one_final_per_project
  ON shipping_info (project_id)
  WHERE shipment_kind = 'final' AND project_id IS NOT NULL;
