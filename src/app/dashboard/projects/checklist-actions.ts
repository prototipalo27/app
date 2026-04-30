"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

export type ChecklistData = {
  entries?: NameEntry[];
  photo_path?: string;
  photo_uploaded_at?: string;
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

export async function uploadQcPhoto(
  itemId: string,
  projectId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; photo_path?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Foto requerida" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "Foto demasiado grande (máx 10 MB)" };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${projectId}/${itemId}-${Date.now()}.${ext}`;

  const { data: existing } = await supabase
    .from("project_checklist_items")
    .select("data")
    .eq("id", itemId)
    .single();

  const { error: uploadError } = await supabase.storage
    .from("qc-photos")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) return { success: false, error: uploadError.message };

  const previousPath = (existing?.data as ChecklistData | null)?.photo_path;

  const newData: ChecklistData = {
    ...((existing?.data as ChecklistData | null) ?? {}),
    photo_path: path,
    photo_uploaded_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("project_checklist_items")
    .update({ data: newData })
    .eq("id", itemId);
  if (updateError) {
    await supabase.storage.from("qc-photos").remove([path]);
    return { success: false, error: updateError.message };
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from("qc-photos").remove([previousPath]);
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true, photo_path: path };
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
