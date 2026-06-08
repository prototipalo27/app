-- Tipo de envío, para distinguir pre-entregas (muestras / entregas parciales)
-- de la entrega final. Solo la entrega final mueve el estado del proyecto
-- (shipping/delivered); las pre-entregas son neutras al estado.
--
-- Esta migración SOLO añade la columna y hace backfill. El UNIQUE(project_id)
-- se retira en una migración posterior (046), una vez desplegado el código que
-- ya no hace upsert sobre ese conflicto — así no se rompe la creación de envíos
-- durante el despliegue.
ALTER TABLE shipping_info
  ADD COLUMN IF NOT EXISTS shipment_kind text NOT NULL DEFAULT 'final'
  CHECK (shipment_kind IN ('sample', 'partial', 'final'));

-- Backfill: lo que hoy se trata como muestra (envío huérfano sin proyecto, o
-- con título "muestra") pasa a 'sample'. El resto queda como 'final'.
UPDATE shipping_info
   SET shipment_kind = 'sample'
 WHERE project_id IS NULL
    OR title ILIKE '%muestra%';
