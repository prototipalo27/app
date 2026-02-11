"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function addItem(projectId: string, name: string, quantity: number) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { error } = await supabase.from("project_items").insert({
    project_id: projectId,
    name: name.trim(),
    quantity: Math.max(1, quantity),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateItemCompleted(itemId: string, completed: number) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  // Fetch item to clamp completed value
  const { data: item } = await supabase
    .from("project_items")
    .select("project_id, quantity")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item not found");

  const clamped = Math.max(0, Math.min(completed, item.quantity));

  const { error } = await supabase
    .from("project_items")
    .update({ completed: clamped })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${item.project_id}`);
  revalidatePath("/dashboard");
}

export async function deleteItem(itemId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  // Fetch project_id for revalidation
  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("project_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  if (item) {
    revalidatePath(`/dashboard/projects/${item.project_id}`);
  }
  revalidatePath("/dashboard");
}
