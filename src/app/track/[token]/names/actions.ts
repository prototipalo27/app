"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { revalidatePath } from "next/cache";

type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

type ChecklistData = {
  entries?: NameEntry[];
  photo_path?: string;
  photo_uploaded_at?: string;
};

export async function submitClientNames(
  token: string,
  itemId: string,
  entries: NameEntry[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("tracking_token", token)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };

  const session = await getVerifiedSession();
  if (!session || session.projectId !== project.id) {
    return { success: false, error: "Sesión no verificada" };
  }

  const { data: item } = await supabase
    .from("project_checklist_items")
    .select("id, project_id, data")
    .eq("id", itemId)
    .single();

  if (!item || item.project_id !== project.id) {
    return { success: false, error: "Item no valido" };
  }

  const merged: ChecklistData = {
    ...((item.data as ChecklistData | null) ?? {}),
    entries,
  };

  const { error } = await supabase
    .from("project_checklist_items")
    .update({ data: merged })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/track/${token}/names`);
  revalidatePath(`/track/${token}/confirm`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function confirmForShipping(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("tracking_token", token)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };

  const session = await getVerifiedSession();
  if (!session || session.projectId !== project.id) {
    return { success: false, error: "Sesión no verificada" };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      client_confirmed_at: new Date().toISOString(),
      client_confirmed_by: session.email,
    })
    .eq("id", project.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/track/${token}/confirm`);
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { success: true };
}
