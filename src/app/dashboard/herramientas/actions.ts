"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";

export async function createResource(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as string;

  if (!title || !type) {
    return { success: false, error: "Título y tipo son obligatorios" };
  }

  const { error } = await supabase.from("tools_resources").insert({
    title,
    description: (formData.get("description") as string)?.trim() || null,
    type,
    content: (formData.get("content") as string)?.trim() || null,
    category: (formData.get("category") as string)?.trim() || null,
    created_by: user?.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/herramientas");
  return { success: true };
}

export async function updateResource(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as string;

  if (!id || !title || !type) {
    return { success: false, error: "Datos incompletos" };
  }

  const { error } = await supabase
    .from("tools_resources")
    .update({
      title,
      description: (formData.get("description") as string)?.trim() || null,
      type,
      content: (formData.get("content") as string)?.trim() || null,
      category: (formData.get("category") as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/herramientas");
  return { success: true };
}

export async function deleteResource(id: string) {
  await requireRole("manager");

  const supabase = await createClient();

  const { error } = await supabase
    .from("tools_resources")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/herramientas");
  return { success: true };
}
