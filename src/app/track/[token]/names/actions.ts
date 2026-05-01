"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { revalidatePath } from "next/cache";

type ClientReviewStatus = "pending" | "approved" | "issue";

type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
  photo_path?: string;
  photo_uploaded_at?: string;
  client_status?: ClientReviewStatus;
  client_comment?: string;
  client_reviewed_at?: string;
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

export async function submitEntryReview(
  token: string,
  itemId: string,
  entryIndex: number,
  status: "approved" | "issue",
  comment?: string,
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
    return { success: false, error: "Item no válido" };
  }

  const data = (item.data as ChecklistData | null) ?? {};
  const entries = data.entries;
  if (!entries || entryIndex < 0 || entryIndex >= entries.length) {
    return { success: false, error: "Entry inválida" };
  }

  if (!entries[entryIndex].photo_path) {
    return { success: false, error: "Esta entrada aún no tiene foto" };
  }

  if (status === "issue" && !comment?.trim()) {
    return { success: false, error: "Indica qué hay que cambiar" };
  }

  entries[entryIndex] = {
    ...entries[entryIndex],
    client_status: status,
    client_comment: status === "issue" ? comment?.trim() : undefined,
    client_reviewed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("project_checklist_items")
    .update({ data: { ...data, entries } })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/track/${token}/review`);
  revalidatePath(`/track/${token}/confirm`);
  revalidatePath(`/dashboard/projects/${project.id}`);
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
