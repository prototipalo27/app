"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const STATUSES = ["brief", "propuesta", "en_curso", "entregado", "cerrado", "cancelado"] as const;
const PAYMENT_STATUSES = ["pendiente", "facturado", "cobrado", "cancelado"] as const;

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

export async function createStudioProject(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const name = strOrNull(formData.get("name"));
  if (!name) redirect("/dashboard/studio/new");

  const totalPrice = strOrNull(formData.get("total_price"));

  const { data: project, error } = await supabase
    .from("studio_projects")
    .insert({
      name,
      status: (formData.get("status") as string) || "brief",
      client_name: strOrNull(formData.get("client_name")),
      client_email: strOrNull(formData.get("client_email")),
      holded_contact_id: strOrNull(formData.get("holded_contact_id")),
      total_price: totalPrice ? parseFloat(totalPrice) : null,
      project_manager_id: strOrNull(formData.get("project_manager_id")),
      start_date: strOrNull(formData.get("start_date")),
      expected_end_date: strOrNull(formData.get("expected_end_date")),
      brief_description: strOrNull(formData.get("brief_description")),
      notes: strOrNull(formData.get("notes")),
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (error || !project) {
    console.error("[studio] createStudioProject failed:", error);
    throw new Error(error?.message ?? "Failed to create studio project");
  }

  revalidatePath("/dashboard/studio");
  redirect(`/dashboard/studio/${project.id}`);
}

export async function updateStudioProjectBrief(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  if (!id) throw new Error("Missing studio project id");

  const status = formData.get("status") as string | null;
  if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error("Invalid status");
  }

  const totalPrice = strOrNull(formData.get("total_price"));

  const { error } = await supabase
    .from("studio_projects")
    .update({
      name: strOrNull(formData.get("name")) ?? undefined,
      status: status ?? undefined,
      client_name: strOrNull(formData.get("client_name")),
      client_email: strOrNull(formData.get("client_email")),
      total_price: totalPrice ? parseFloat(totalPrice) : null,
      start_date: strOrNull(formData.get("start_date")),
      expected_end_date: strOrNull(formData.get("expected_end_date")),
      brief_description: strOrNull(formData.get("brief_description")),
      brief_objectives: strOrNull(formData.get("brief_objectives")),
      brief_constraints: strOrNull(formData.get("brief_constraints")),
      brief_references: strOrNull(formData.get("brief_references")),
      nda_project_description: strOrNull(formData.get("nda_project_description")),
      notes: strOrNull(formData.get("notes")),
      project_manager_id: strOrNull(formData.get("project_manager_id")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${id}`);
  revalidatePath("/dashboard/studio");
}

export async function updateStudioProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const status = formData.get("status") as string | null;
  if (!id || !status) throw new Error("Missing id or status");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new Error("Invalid status");

  const { error } = await supabase
    .from("studio_projects")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${id}`);
  revalidatePath("/dashboard/studio");
}

export async function deleteStudioProject(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  if (!id) throw new Error("Missing studio project id");

  const { error } = await supabase.from("studio_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/studio");
  redirect("/dashboard/studio");
}

// ---------- Pagos ----------

export async function addStudioPayment(formData: FormData) {
  const supabase = await createClient();
  const projectId = strOrNull(formData.get("studio_project_id"));
  const label = strOrNull(formData.get("label"));
  const amount = strOrNull(formData.get("amount"));
  if (!projectId || !label || !amount) throw new Error("Missing payment fields");

  const { data: existing } = await supabase
    .from("studio_payments")
    .select("position")
    .eq("studio_project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.position ?? -1) + 1;

  const { error } = await supabase.from("studio_payments").insert({
    studio_project_id: projectId,
    label,
    amount: parseFloat(amount),
    due_date: strOrNull(formData.get("due_date")),
    status: (formData.get("status") as string) || "pendiente",
    position: nextPosition,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioPayment(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Missing payment id");

  const status = formData.get("status") as string | null;
  if (status && !PAYMENT_STATUSES.includes(status as (typeof PAYMENT_STATUSES)[number])) {
    throw new Error("Invalid payment status");
  }

  const amount = strOrNull(formData.get("amount"));

  const { error } = await supabase
    .from("studio_payments")
    .update({
      label: strOrNull(formData.get("label")) ?? undefined,
      amount: amount ? parseFloat(amount) : undefined,
      due_date: strOrNull(formData.get("due_date")),
      status: status ?? undefined,
      paid_at: status === "cobrado" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function deleteStudioPayment(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Missing payment id");

  const { error } = await supabase.from("studio_payments").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}
