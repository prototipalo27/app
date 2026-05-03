"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

export async function addStudioMember(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const projectId = strOrNull(formData.get("studio_project_id"));
  const userId = strOrNull(formData.get("user_id"));
  if (!projectId || !userId) throw new Error("Falta proyecto o usuario");

  const { error } = await supabase.from("studio_project_members").insert({
    studio_project_id: projectId,
    user_id: userId,
    role: strOrNull(formData.get("role")),
    created_by: userData.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      // Ya es miembro: ignoramos el alta duplicada para que el toggle sea idempotente.
      revalidatePath(`/dashboard/studio/${projectId}`);
      return;
    }
    console.error("[studio] addStudioMember failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioMemberRole(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_project_members")
    .update({ role: strOrNull(formData.get("role")) })
    .eq("id", id);

  if (error) {
    console.error("[studio] updateStudioMemberRole failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function removeStudioMember(formData: FormData) {
  const supabase = await createClient();
  const projectId = strOrNull(formData.get("studio_project_id"));
  const id = strOrNull(formData.get("id"));
  const userId = strOrNull(formData.get("user_id"));
  if (!projectId) throw new Error("Falta proyecto");
  if (!id && !userId) throw new Error("Falta id o user_id");

  const query = supabase
    .from("studio_project_members")
    .delete()
    .eq("studio_project_id", projectId);

  const { error } = id
    ? await query.eq("id", id)
    : await query.eq("user_id", userId!);

  if (error) {
    console.error("[studio] removeStudioMember failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}
