"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { syncHoldedDocuments, type SyncResult } from "@/lib/holded/sync";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  if (!name?.trim()) {
    redirect("/dashboard/projects/new");
  }

  const price = formData.get("price") as string;
  const printTime = formData.get("print_time_minutes") as string;

  const { error } = await supabase.from("projects").insert({
    name: name.trim(),
    description: (formData.get("description") as string)?.trim() || null,
    project_type: (formData.get("project_type") as string) || "confirmed",
    holded_contact_id: (formData.get("holded_contact_id") as string)?.trim() || null,
    client_name: (formData.get("client_name") as string)?.trim() || null,
    client_email: (formData.get("client_email") as string)?.trim() || null,
    price: price ? parseFloat(price) : null,
    material: (formData.get("material") as string)?.trim() || null,
    assigned_printer: (formData.get("assigned_printer") as string)?.trim() || null,
    print_time_minutes: printTime ? parseInt(printTime, 10) : null,
    notes: (formData.get("notes") as string)?.trim() || null,
    created_by: userData.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard");
}

export async function updateProjectStatusById(id: string, status: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function updateProjectDeadline(projectId: string, deadline: string | null) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("projects")
    .update({ deadline })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function triggerHoldedSync(): Promise<SyncResult> {
  await requireRole("manager");
  const result = await syncHoldedDocuments();
  revalidatePath("/dashboard");
  return result;
}

export async function discardProject(id: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("projects")
    .update({ project_type: "discarded", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function deleteProject(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
