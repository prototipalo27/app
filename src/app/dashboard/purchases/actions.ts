"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getUserProfile } from "@/lib/rbac";
import { sendPushToUser } from "@/lib/push-notifications/server";

const PATH = "/dashboard/purchases";
const IAN_USER_ID = "cd95b109-3af7-4658-b782-cb0f2f3419c3";

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

  const { data: purchaseItem, error } = await supabase
    .from("purchase_items")
    .insert({
      description: description.trim(),
      link: (formData.get("link") as string)?.trim() || null,
      quantity: quantity ? parseInt(quantity, 10) : 1,
      estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : null,
      project_id: projectId || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Auto-create task assigned to Ian for every purchase request
  const taskTitle = `Compra solicitada: ${description.trim()}`;
  const qty = quantity ? parseInt(quantity, 10) : 1;
  const priceInfo = estimatedPrice ? ` · Precio est. ${parseFloat(estimatedPrice).toFixed(2)}€` : "";
  const taskDescription = `Solicitud de compra de ${profile.email.split("@")[0]}.\n\nItem: ${description.trim()} (x${qty})${priceInfo}`;

  const { data: task } = await supabase
    .from("tasks")
    .insert({
      title: taskTitle,
      description: taskDescription,
      priority: "medium",
      assigned_to: IAN_USER_ID,
      project_id: projectId || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (task) {
    sendPushToUser(IAN_USER_ID, {
      title: "Nueva solicitud de compra",
      body: taskTitle,
      url: `/dashboard/tareas/${task.id}`,
    }).catch(() => {});
  }

  revalidatePath(PATH);
  revalidatePath("/dashboard/tareas");
}

// ── Mark as purchased (manager) ───────────────────────────

export async function markAsPurchased(
  itemId: string,
  actualPrice: number | null,
  estimatedDelivery: string | null,
  supplierId: string | null
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Fetch item details before updating (for notification)
  const { data: item } = await supabase
    .from("purchase_items")
    .select("description, created_by")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("purchase_items")
    .update({
      status: "purchased",
      actual_price: actualPrice,
      estimated_delivery: estimatedDelivery || null,
      purchased_at: new Date().toISOString(),
      purchased_by: profile.id,
      provider: supplierId || null,
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  // Notify the person who requested the purchase
  if (item?.created_by && item.created_by !== profile.id) {
    sendPushToUser(item.created_by, {
      title: "Tu compra ha sido procesada",
      body: item.description,
      url: PATH,
    }).catch(() => {});
  }

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

  // Auto-add to supplier catalogue if item has a provider
  const { data: item } = await supabase
    .from("purchase_items")
    .select("description, link, actual_price, provider")
    .eq("id", itemId)
    .single();

  if (item?.provider) {
    await supabase.from("supplier_products").insert({
      supplier_id: item.provider,
      name: item.description,
      url: item.link,
      price: item.actual_price,
    });
  }

  revalidatePath(PATH);
  revalidatePath("/dashboard/suppliers/products");
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
