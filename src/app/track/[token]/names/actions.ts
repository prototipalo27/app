"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

export async function submitClientNames(
  token: string,
  itemId: string,
  entries: NameEntry[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Verify the token maps to a project that owns this item
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("tracking_token", token)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };

  // Verify item belongs to this project
  const { data: item } = await supabase
    .from("project_checklist_items")
    .select("id, project_id")
    .eq("id", itemId)
    .single();

  if (!item || item.project_id !== project.id) {
    return { success: false, error: "Item no valido" };
  }

  const { error } = await supabase
    .from("project_checklist_items")
    .update({ data: { entries } })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/track/${token}/names`);
  revalidatePath("/dashboard");
  return { success: true };
}
