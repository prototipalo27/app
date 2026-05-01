"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCollaboratorName(formData: FormData) {
  const token = (formData.get("token") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!token || !name) throw new Error("Falta token o nombre");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("studio_project_collaborators")
    .update({ name })
    .eq("token", token);

  if (error) {
    console.error("[studio-portal] setCollaboratorName failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/studio-portal/${token}`);
}
