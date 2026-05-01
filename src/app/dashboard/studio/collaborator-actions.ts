"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true";
}

export async function addStudioCollaborator(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const projectId = strOrNull(formData.get("studio_project_id"));
  const email = strOrNull(formData.get("email"));
  if (!projectId || !email) throw new Error("Falta proyecto o email");

  const { error } = await supabase.from("studio_project_collaborators").insert({
    studio_project_id: projectId,
    email: email.toLowerCase(),
    name: strOrNull(formData.get("name")),
    can_see_brief: bool(formData.get("can_see_brief")),
    can_see_meetings: bool(formData.get("can_see_meetings")),
    can_see_payments: bool(formData.get("can_see_payments")),
    can_see_documents: bool(formData.get("can_see_documents")),
    created_by: userData.user.id,
  });

  if (error) {
    console.error("[studio] addStudioCollaborator failed:", error);
    if (error.code === "23505") {
      throw new Error(`Ya hay un colaborador con el email ${email} en este proyecto`);
    }
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioCollaboratorAccess(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_project_collaborators")
    .update({
      name: strOrNull(formData.get("name")),
      can_see_brief: bool(formData.get("can_see_brief")),
      can_see_meetings: bool(formData.get("can_see_meetings")),
      can_see_payments: bool(formData.get("can_see_payments")),
      can_see_documents: bool(formData.get("can_see_documents")),
    })
    .eq("id", id);

  if (error) {
    console.error("[studio] updateStudioCollaboratorAccess failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function deleteStudioCollaborator(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_project_collaborators")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[studio] deleteStudioCollaborator failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}
