"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ── Purchase Lists ─────────────────────────────────────────

export async function createPurchaseList(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const title = formData.get("title") as string;
  if (!title?.trim()) {
    redirect("/dashboard/purchases/new");
  }

  const projectId = (formData.get("project_id") as string)?.trim() || null;

  const { data, error } = await supabase
    .from("purchase_lists")
    .insert({
      title: title.trim(),
      notes: (formData.get("notes") as string)?.trim() || null,
      project_id: projectId || null,
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/purchases");
  redirect(`/dashboard/purchases/${data.id}`);
}

export async function closePurchaseList(listId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("purchase_lists")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", listId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/purchases/${listId}`);
  revalidatePath("/dashboard/purchases");
}

export async function reopenPurchaseList(listId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("purchase_lists")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", listId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/purchases/${listId}`);
  revalidatePath("/dashboard/purchases");
}

export async function deletePurchaseList(listId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("purchase_lists")
    .delete()
    .eq("id", listId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/purchases");
  redirect("/dashboard/purchases");
}

// ── Purchase Items ─────────────────────────────────────────

export async function addPurchaseItem(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const description = formData.get("description") as string;
  if (!description?.trim()) return;

  const listId = formData.get("purchase_list_id") as string;
  const quantity = formData.get("quantity") as string;
  const estimatedPrice = formData.get("estimated_price") as string;

  const { error } = await supabase.from("purchase_items").insert({
    purchase_list_id: listId,
    description: description.trim(),
    link: (formData.get("link") as string)?.trim() || null,
    quantity: quantity ? parseInt(quantity, 10) : 1,
    item_type: (formData.get("item_type") as string) || "general",
    estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : null,
    notes: (formData.get("notes") as string)?.trim() || null,
    created_by: userData.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/purchases/${listId}`);
  revalidatePath("/dashboard/purchases");
}

export async function updatePurchaseItemStatus(
  itemId: string,
  status: string,
  listId: string,
  actualPrice?: number
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const updates: Record<string, unknown> = { status };

  if (status === "purchased") {
    updates.purchased_at = new Date().toISOString();
    updates.purchased_by = userData.user.id;
    if (actualPrice !== undefined) {
      updates.actual_price = actualPrice;
    }
  } else if (status === "received") {
    updates.received_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("purchase_items")
    .update(updates)
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/purchases/${listId}`);
  revalidatePath("/dashboard/purchases");
}

export async function deletePurchaseItem(itemId: string, listId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("purchase_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/purchases/${listId}`);
  revalidatePath("/dashboard/purchases");
}
