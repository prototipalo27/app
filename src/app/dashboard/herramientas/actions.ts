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

export async function uploadResourceFile(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File;
  const title = (formData.get("title") as string)?.trim();
  const category = (formData.get("category") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!file || !title) {
    return { success: false, error: "Archivo y título son obligatorios" };
  }

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() || "bin";
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage
    .from("resources")
    .upload(path, file);

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("resources")
    .getPublicUrl(path);

  const isImage = ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext.toLowerCase());

  // Create resource entry with public URL
  const { error } = await supabase.from("tools_resources").insert({
    title,
    description,
    type: isImage ? "imagen" : "archivo",
    content: urlData.publicUrl,
    category,
    created_by: user?.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/herramientas");
  return { success: true, url: urlData.publicUrl };
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
