"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

// ─── Gastos ──────────────────────────────────────────────

export async function addStudioExpense(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const projectId = strOrNull(formData.get("studio_project_id"));
  const concept = strOrNull(formData.get("concept"));
  const amountRaw = strOrNull(formData.get("amount"));
  if (!projectId || !concept || !amountRaw) {
    throw new Error("Falta proyecto, concepto o importe");
  }

  const { error } = await supabase.from("studio_expenses").insert({
    studio_project_id: projectId,
    concept,
    amount: parseFloat(amountRaw),
    expense_date: strOrNull(formData.get("expense_date")) ?? new Date().toISOString().slice(0, 10),
    category: strOrNull(formData.get("category")),
    supplier: strOrNull(formData.get("supplier")),
    notes: strOrNull(formData.get("notes")),
    created_by: userData.user.id,
  });

  if (error) {
    console.error("[studio] addStudioExpense failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioExpense(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const amountRaw = strOrNull(formData.get("amount"));

  const { error } = await supabase
    .from("studio_expenses")
    .update({
      concept: strOrNull(formData.get("concept")) ?? undefined,
      amount: amountRaw ? parseFloat(amountRaw) : undefined,
      expense_date: strOrNull(formData.get("expense_date")) ?? undefined,
      category: strOrNull(formData.get("category")),
      supplier: strOrNull(formData.get("supplier")),
      notes: strOrNull(formData.get("notes")),
    })
    .eq("id", id);

  if (error) {
    console.error("[studio] updateStudioExpense failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function deleteStudioExpense(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_expenses")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}

// ─── Horas imputadas ─────────────────────────────────────

export async function addStudioTimeEntry(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const projectId = strOrNull(formData.get("studio_project_id"));
  const hoursRaw = strOrNull(formData.get("hours"));
  if (!projectId || !hoursRaw) throw new Error("Falta proyecto u horas");

  const userId = strOrNull(formData.get("user_id"));
  let userLabel = strOrNull(formData.get("user_label"));

  // Si no nos pasan label pero sí user_id, intentamos sacarlo del perfil.
  if (userId && !userLabel) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("nickname, full_name, email")
      .eq("id", userId)
      .single();
    if (profile) {
      userLabel = profile.nickname || profile.full_name || profile.email.split("@")[0];
    }
  }

  const { error } = await supabase.from("studio_time_entries").insert({
    studio_project_id: projectId,
    user_id: userId,
    user_label: userLabel,
    hours: parseFloat(hoursRaw),
    work_date: strOrNull(formData.get("work_date")) ?? new Date().toISOString().slice(0, 10),
    description: strOrNull(formData.get("description")),
    created_by: userData.user.id,
  });

  if (error) {
    console.error("[studio] addStudioTimeEntry failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioTimeEntry(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const hoursRaw = strOrNull(formData.get("hours"));
  const userId = strOrNull(formData.get("user_id"));
  let userLabel = strOrNull(formData.get("user_label"));

  if (userId && !userLabel) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("nickname, full_name, email")
      .eq("id", userId)
      .single();
    if (profile) {
      userLabel = profile.nickname || profile.full_name || profile.email.split("@")[0];
    }
  }

  const { error } = await supabase
    .from("studio_time_entries")
    .update({
      user_id: userId,
      user_label: userLabel,
      hours: hoursRaw ? parseFloat(hoursRaw) : undefined,
      work_date: strOrNull(formData.get("work_date")) ?? undefined,
      description: strOrNull(formData.get("description")),
    })
    .eq("id", id);

  if (error) {
    console.error("[studio] updateStudioTimeEntry failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function deleteStudioTimeEntry(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_time_entries")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}
