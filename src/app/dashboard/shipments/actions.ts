"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";

export async function linkShipmentToProject(shipmentId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipping_info")
    .update({ project_id: projectId })
    .eq("id", shipmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/shipments");
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function unlinkShipmentFromProject(shipmentId: string) {
  const supabase = await createClient();

  // Get current project_id before unlinking
  const { data: shipping } = await supabase
    .from("shipping_info")
    .select("project_id")
    .eq("id", shipmentId)
    .single();

  const { error } = await supabase
    .from("shipping_info")
    .update({ project_id: null })
    .eq("id", shipmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/shipments");
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  if (shipping?.project_id) {
    revalidatePath(`/dashboard/projects/${shipping.project_id}`);
  }
}

export async function deleteShipment(shipmentId: string) {
  await requireRole("manager");

  const supabase = await createClient();

  // Only allow deleting standalone shipments
  const { data: shipping } = await supabase
    .from("shipping_info")
    .select("project_id")
    .eq("id", shipmentId)
    .single();

  if (shipping?.project_id) {
    throw new Error("Cannot delete a shipment linked to a project. Unlink it first.");
  }

  const { error } = await supabase
    .from("shipping_info")
    .delete()
    .eq("id", shipmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/shipments");
}
