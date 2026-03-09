"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getUserProfile } from "@/lib/rbac";
import { sendPushToUser } from "@/lib/push-notifications/server";

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

  // Auto-create task and notify all managers about the purchase request
  const taskTitle = `Compra solicitada: ${description.trim()}`;
  const qty = quantity ? parseInt(quantity, 10) : 1;
  const priceInfo = estimatedPrice ? ` · Precio est. ${parseFloat(estimatedPrice).toFixed(2)}€` : "";
  const taskDescription = `Solicitud de compra de ${profile.email.split("@")[0]}.\n\nItem: ${description.trim()} (x${qty})${priceInfo}`;

  // Get all managers and super_admins
  const { data: managers } = await supabase
    .from("user_profiles")
    .select("id")
    .in("role", ["manager", "super_admin"])
    .eq("is_active", true)
    .neq("id", profile.id);

  // Create task assigned to first manager (Ian if available, else first manager)
  const assignTo = managers?.find((m) => m.id === "cd95b109-3af7-4658-b782-cb0f2f3419c3")?.id
    ?? managers?.[0]?.id
    ?? profile.id;

  const { data: task } = await supabase
    .from("tasks")
    .insert({
      title: taskTitle,
      description: taskDescription,
      priority: "medium",
      assigned_to: assignTo,
      project_id: projectId || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  // Notify ALL managers (not just the task assignee)
  if (task && managers?.length) {
    for (const mgr of managers) {
      sendPushToUser(mgr.id, {
        title: "Nueva solicitud de compra",
        body: taskTitle,
        url: `/dashboard/purchases`,
      }).catch(() => {});
    }
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

  // Auto-close the associated purchase task
  if (item?.description) {
    const taskTitle = `Compra solicitada: ${item.description}`;
    await supabase
      .from("tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("title", taskTitle)
      .eq("status", "pending");
  }

  // Notify the person who requested the purchase
  if (item?.created_by && item.created_by !== profile.id) {
    sendPushToUser(item.created_by, {
      title: "Tu compra ha sido procesada",
      body: item.description,
      url: PATH,
    }).catch(() => {});
  }

  revalidatePath(PATH);
  revalidatePath("/dashboard/tareas");
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

// ── Edit item (creator while pending, or manager) ────────

export async function editPurchaseItem(
  itemId: string,
  data: {
    description: string;
    link: string | null;
    quantity: number;
    estimated_price: number | null;
    project_id: string | null;
  }
) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();

  // Verify item exists and is editable
  const { data: item } = await supabase
    .from("purchase_items")
    .select("created_by, status")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item no encontrado");

  // Only pending items can be edited; managers can edit any pending, employees only their own
  if (item.status !== "pending") {
    throw new Error("Solo se pueden editar items pendientes");
  }
  if (profile.role === "employee" && item.created_by !== profile.id) {
    throw new Error("No tienes permiso para editar este item");
  }

  const { error } = await supabase
    .from("purchase_items")
    .update({
      description: data.description.trim(),
      link: data.link?.trim() || null,
      quantity: data.quantity,
      estimated_price: data.estimated_price,
      project_id: data.project_id || null,
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
