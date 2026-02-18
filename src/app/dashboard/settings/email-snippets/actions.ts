"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = [
  "saludo",
  "pagos",
  "envios",
  "plazos",
  "materiales",
  "cierre",
] as const;

const PATH = "/dashboard/settings/email-snippets";

export async function createSnippet(formData: FormData) {
  await requireRole("manager");
  const supabase = await createClient();

  const title = (formData.get("title") as string)?.trim();
  const category = formData.get("category") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!title || !content || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) return;

  // Get max sort_order for this category
  const { data: existing } = await supabase
    .from("email_snippets")
    .select("sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

  const { error } = await supabase.from("email_snippets").insert({
    title,
    category,
    content,
    sort_order: nextOrder,
  });

  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function updateSnippet(id: string, formData: FormData) {
  await requireRole("manager");
  const supabase = await createClient();

  const title = (formData.get("title") as string)?.trim();
  const category = formData.get("category") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!title || !content || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) return;

  const { error } = await supabase
    .from("email_snippets")
    .update({
      title,
      category,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function deleteSnippet(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_snippets")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}
