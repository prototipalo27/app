"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

export async function toggleChecklistItem(
  itemId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("project_checklist_items")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? userData.user.id : null,
    })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function uploadNameList(
  itemId: string,
  entries: NameEntry[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("project_checklist_items")
    .update({
      data: { entries },
    })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleNameEntry(
  itemId: string,
  nameIndex: number,
  checked: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch current data
  const { data: item } = await supabase
    .from("project_checklist_items")
    .select("data")
    .eq("id", itemId)
    .single();

  if (!item) return { success: false, error: "Item not found" };

  const data = item.data as { entries?: NameEntry[] } | null;
  const entries = data?.entries;
  if (!entries || nameIndex < 0 || nameIndex >= entries.length) {
    return { success: false, error: "Invalid index" };
  }

  entries[nameIndex].checked = checked;

  const { error } = await supabase
    .from("project_checklist_items")
    .update({ data: { entries } })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
