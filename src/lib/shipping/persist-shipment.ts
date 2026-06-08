import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Persiste una fila de envío en `shipping_info`.
 *
 * - Entrega final con proyecto: reutiliza (UPDATE) la fila `final` del proyecto
 *   si ya existe (p. ej. el placeholder de dirección creado en la proforma, o
 *   una final anterior). Así hay como mucho UNA entrega final por proyecto.
 * - Pre-entregas (muestra/parcial) y envíos sin proyecto: siempre INSERT.
 *
 * Devuelve el error de Postgres (o null si todo fue bien).
 */
export async function persistShipmentRow(
  supabase: Supa,
  row: Record<string, unknown>,
  projectId: string | null | undefined,
  isFinal: boolean,
): Promise<{ message: string } | null> {
  if (projectId && isFinal) {
    const { data: existing } = await supabase
      .from("shipping_info")
      .select("id")
      .eq("project_id", projectId)
      .eq("shipment_kind", "final")
      .limit(1)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("shipping_info").update(row).eq("id", existing.id)
      : await supabase.from("shipping_info").insert(row);
    return error ?? null;
  }

  const { error } = await supabase.from("shipping_info").insert(row);
  return error ?? null;
}
