import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Devuelve, por lead, la base de comisión (sin IVA) de las ampliaciones ya
 * PAGADAS de sus proyectos.
 *
 * Las ampliaciones (`project_items.is_addon = true`) son ventas aparte con su
 * propia factura, pero representan el crecimiento del trato, así que cuentan
 * para la comisión del comercial — al mismo % y imputadas al mes del trato
 * original (es decir, se suman a la base del lead allí donde ya se calcula).
 *
 * Base = unit_price * quantity (sin IVA), igual convención que la comisión del
 * presupuesto (`price * units`).
 *
 * Consulta en dos pasos (lead → proyectos → items) para no depender de filtros
 * sobre recursos embebidos de PostgREST.
 */
export async function getPaidAddonBaseByLead(
  supabase: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (leadIds.length === 0) return map;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, lead_id")
    .in("lead_id", leadIds);

  const projToLead = new Map<string, string>();
  for (const p of (projects || []) as Array<{ id: string; lead_id: string | null }>) {
    if (p.lead_id) projToLead.set(p.id, p.lead_id);
  }
  const projectIds = [...projToLead.keys()];
  if (projectIds.length === 0) return map;

  const { data: items } = await supabase
    .from("project_items")
    .select("unit_price, quantity, project_id")
    .eq("is_addon", true)
    .eq("addon_status", "paid")
    .in("project_id", projectIds);

  for (const it of (items || []) as Array<{ unit_price: number | null; quantity: number | null; project_id: string }>) {
    const leadId = projToLead.get(it.project_id);
    if (!leadId) continue;
    const base = Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
    if (base > 0) map.set(leadId, (map.get(leadId) ?? 0) + base);
  }

  return map;
}
