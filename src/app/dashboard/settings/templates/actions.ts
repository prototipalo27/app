"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTemplate(formData: FormData) {
  await requireRole("manager");
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const { data, error } = await supabase
    .from("project_templates")
    .insert({
      name,
      description: (formData.get("description") as string)?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/templates");
  redirect(`/dashboard/settings/templates/${data.id}`);
}

export async function updateTemplate(id: string, formData: FormData) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_templates")
    .update({
      name: (formData.get("name") as string)?.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/templates");
  revalidatePath(`/dashboard/settings/templates/${id}`);
}

export async function deleteTemplate(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_templates")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/templates");
  redirect("/dashboard/settings/templates");
}

export async function addTemplateItem(
  templateId: string,
  name: string,
  itemType: string
) {
  await requireRole("manager");
  const supabase = await createClient();

  // Get max position
  const { data: existing } = await supabase
    .from("template_checklist_items")
    .select("position")
    .eq("template_id", templateId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { error } = await supabase.from("template_checklist_items").insert({
    template_id: templateId,
    name: name.trim(),
    item_type: itemType,
    position: nextPosition,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/settings/templates/${templateId}`);
}

export async function deleteTemplateItem(itemId: string, templateId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("template_checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/settings/templates/${templateId}`);
}

export async function reorderTemplateItems(
  templateId: string,
  orderedIds: string[]
) {
  await requireRole("manager");
  const supabase = await createClient();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("template_checklist_items")
      .update({ position: i })
      .eq("id", orderedIds[i]);

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/settings/templates/${templateId}`);
}
