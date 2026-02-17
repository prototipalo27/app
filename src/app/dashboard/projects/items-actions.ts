"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const isDev = process.env.NODE_ENV === "development";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  if (!isDev) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      redirect("/login");
    }
  }
  return supabase;
}

export async function addItem(projectId: string, name: string, quantity: number, batchSize: number = 1) {
  const supabase = await getAuthenticatedClient();

  const { error } = await supabase.from("project_items").insert({
    project_id: projectId,
    name: name.trim(),
    quantity: Math.max(1, quantity),
    batch_size: Math.max(1, batchSize),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateItemCompleted(itemId: string, completed: number) {
  const supabase = await getAuthenticatedClient();

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

export async function updateItemBatchSize(itemId: string, batchSize: number) {
  const supabase = await getAuthenticatedClient();

  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item not found");

  const { error } = await supabase
    .from("project_items")
    .update({ batch_size: Math.max(1, batchSize) })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${item.project_id}`);
}

export async function updateItemFileKeyword(itemId: string, fileKeyword: string | null) {
  const supabase = await getAuthenticatedClient();

  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item not found");

  const { error } = await supabase
    .from("project_items")
    .update({ file_keyword: fileKeyword || null })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${item.project_id}`);
}

export async function updateItemNotes(itemId: string, notes: string | null) {
  const supabase = await getAuthenticatedClient();

  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item not found");

  const { error } = await supabase
    .from("project_items")
    .update({ notes: notes || null })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${item.project_id}`);
}

export async function deleteItem(itemId: string) {
  const supabase = await getAuthenticatedClient();

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
