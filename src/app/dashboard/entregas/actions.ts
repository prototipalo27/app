"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { syncProjectDeliveryEvents } from "@/lib/google-calendar/client";

export async function updateDeliveryLeadHours(hours: number) {
  await requireRole("manager");

  if (!Number.isFinite(hours) || hours < 0 || hours > 1000) {
    return { success: false, error: "Valor fuera de rango" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_metadata")
    .upsert({
      key: "delivery_lead_hours",
      value: String(Math.round(hours)),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  // Al cambiar el threshold, re-sincronizamos todos los proyectos
  // con deadline para que sus prep-events se muevan al nuevo día.
  resyncAllDeliveries().catch((e) => console.error("[lead-hours] resync failed", e));

  revalidatePath("/dashboard/entregas");
  return { success: true };
}

/** Re-sincroniza todos los proyectos confirmados con deadline. Manager-only. */
export async function resyncAllDeliveries(): Promise<{ success: boolean; synced: number; error?: string }> {
  await requireRole("manager");

  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id")
    .eq("project_type", "confirmed")
    .neq("status", "delivered")
    .not("deadline", "is", null);

  if (error) return { success: false, synced: 0, error: error.message };

  // Secuencial para no martillear la API de Google
  let synced = 0;
  for (const p of projects ?? []) {
    try {
      await syncProjectDeliveryEvents(p.id);
      synced++;
    } catch (e) {
      console.error("[resync] failed for", p.id, e);
    }
  }

  revalidatePath("/dashboard/entregas");
  return { success: true, synced };
}
