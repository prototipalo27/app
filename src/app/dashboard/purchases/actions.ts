"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function addPurchaseItem(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const description = formData.get("description") as string;
  if (!description?.trim()) return;

  const quantity = formData.get("quantity") as string;
  const estimatedPrice = formData.get("estimated_price") as string;

  const { error } = await supabase.from("purchase_items").insert({
    purchase_list_id: null,
    description: description.trim(),
    link: (formData.get("link") as string)?.trim() || null,
    quantity: quantity ? parseInt(quantity, 10) : 1,
    item_type: (formData.get("item_type") as string) || "general",
    provider: (formData.get("provider") as string) || "general",
    estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : null,
    notes: (formData.get("notes") as string)?.trim() || null,
    created_by: userData.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/purchases");
}

export async function updatePurchaseItemStatus(
  itemId: string,
  status: string,
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

  revalidatePath("/dashboard/purchases");
}

export async function deletePurchaseItem(itemId: string) {
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

  revalidatePath("/dashboard/purchases");
}

export async function clearPurchasedItems() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("purchase_items")
    .delete()
    .eq("status", "received");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/purchases");
}
