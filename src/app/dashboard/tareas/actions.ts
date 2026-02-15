"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const title = formData.get("title") as string;
  if (!title?.trim()) {
    redirect("/dashboard/tareas/new");
  }

  const assignedTo = (formData.get("assigned_to") as string)?.trim() || null;
  const projectId = (formData.get("project_id") as string)?.trim() || null;
  const dueDate = (formData.get("due_date") as string)?.trim() || null;

  const { error } = await supabase.from("tasks").insert({
    title: title.trim(),
    description: (formData.get("description") as string)?.trim() || null,
    priority: (formData.get("priority") as string) || "medium",
    assigned_to: assignedTo,
    project_id: projectId,
    due_date: dueDate,
    created_by: userData.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/tareas");
  redirect("/dashboard/tareas");
}

export async function updateTask(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  if (!title?.trim()) {
    redirect(`/dashboard/tareas/${id}`);
  }

  const assignedTo = (formData.get("assigned_to") as string)?.trim() || null;
  const projectId = (formData.get("project_id") as string)?.trim() || null;
  const dueDate = (formData.get("due_date") as string)?.trim() || null;

  const { error } = await supabase
    .from("tasks")
    .update({
      title: title.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      priority: (formData.get("priority") as string) || "medium",
      status: (formData.get("status") as string) || "pending",
      assigned_to: assignedTo,
      project_id: projectId,
      due_date: dueDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/tareas");
  revalidatePath(`/dashboard/tareas/${id}`);
  redirect(`/dashboard/tareas/${id}`);
}

export async function updateTaskStatus(
  id: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/tareas");
  revalidatePath(`/dashboard/tareas/${id}`);
  return { success: true };
}

export async function deleteTask(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const id = formData.get("id") as string;

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/tareas");
  redirect("/dashboard/tareas");
}
