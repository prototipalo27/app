"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getUserProfile } from "@/lib/rbac";

const PATH = "/dashboard/purchases";

// ── Add item (any employee) ───────────────────────────────

export async function addPurchaseItem(formData: FormData) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();
  const description = formData.get("description") as string;
  if (!description?.trim()) return;

  const quantity = formData.get("quantity") as string;
  const estimatedPrice = formData.get("estimated_price") as string;
  const projectId = (formData.get("project_id") as string)?.trim() || null;

  const { error } = await supabase.from("purchase_items").insert({
    description: description.trim(),
    link: (formData.get("link") as string)?.trim() || null,
    quantity: quantity ? parseInt(quantity, 10) : 1,
    estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : null,
    project_id: projectId || null,
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ── Mark as purchased (manager) ───────────────────────────

export async function markAsPurchased(
  itemId: string,
  actualPrice: number | null,
  estimatedDelivery: string | null
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_items")
    .update({
      status: "purchased",
      actual_price: actualPrice,
      estimated_delivery: estimatedDelivery || null,
      purchased_at: new Date().toISOString(),
      purchased_by: profile.id,
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ── Reject item (manager) ─────────────────────────────────

export async function rejectItem(itemId: string, reason: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_items")
    .update({
      status: "rejected",
      rejection_reason: reason.trim() || null,
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ── Mark as received (manager) ────────────────────────────

export async function markAsReceived(itemId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_items")
    .update({
      status: "received",
      received_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ── Delete item (creator or manager) ──────────────────────

export async function deletePurchaseItem(itemId: string) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();

  // Check ownership — managers can delete any, employees only their own
  if (profile.role === "employee") {
    const { data: item } = await supabase
      .from("purchase_items")
      .select("created_by")
      .eq("id", itemId)
      .single();

    if (!item || item.created_by !== profile.id) {
      throw new Error("No tienes permiso para eliminar este item");
    }
  }

  const { error } = await supabase
    .from("purchase_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
