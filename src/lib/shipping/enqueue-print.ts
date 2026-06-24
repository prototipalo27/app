import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Encola un trabajo de impresión para una etiqueta ya guardada en Storage.
 *
 * El agente local (scripts/print-agent) escucha los INSERT de
 * `label_print_jobs` por Supabase Realtime y manda el PDF a la térmica.
 *
 * No lanza: si el encolado falla, lo registra y sigue. Imprimir no debe
 * romper la creación del envío (mismo criterio que el email de notificación).
 */
export async function enqueueLabelPrint(
  supabase: Supa,
  params: { labelUrl: string; shipmentId?: string | null; createdBy?: string | null },
): Promise<void> {
  const { error } = await supabase.from("label_print_jobs").insert({
    label_url: params.labelUrl,
    source_kind: "shipping_info",
    source_id: params.shipmentId ?? null,
    created_by: params.createdBy ?? null,
  });
  if (error) {
    console.error("[auto-print] enqueue failed:", error.message);
  }
}
