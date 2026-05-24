"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

type TimeEntryKind = "engineering" | "print";

function parseKind(v: FormDataEntryValue | null): TimeEntryKind {
  return v === "print" ? "print" : "engineering";
}

// Devuelve { isManager, isMember } para un usuario en un proyecto Studio.
// Usado por las acciones de horas: los managers pueden hacer cualquier
// imputación; los miembros del proyecto solo las suyas.
async function getProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
): Promise<{ isManager: boolean; isMember: boolean }> {
  const profile = await getUserProfile();
  const isManager = profile ? hasRole(profile.role, "manager") : false;

  if (isManager) return { isManager: true, isMember: true };

  const { data } = await supabase
    .from("studio_project_members")
    .select("id")
    .eq("studio_project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  return { isManager: false, isMember: !!data };
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

  const access = await getProjectAccess(supabase, userData.user.id, projectId);
  if (!access.isManager && !access.isMember) {
    throw new Error("Solo los miembros del proyecto pueden imputar horas.");
  }

  // Los empleados solo pueden imputar SUS propias horas. Los managers
  // pueden imputar en nombre de cualquiera del equipo.
  const formUserId = strOrNull(formData.get("user_id"));
  const userId = access.isManager ? formUserId : userData.user.id;
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
    kind: parseKind(formData.get("kind")),
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const access = await getProjectAccess(supabase, userData.user.id, projectId);
  if (!access.isManager) {
    // Si no es manager, solo puede editar imputaciones suyas.
    const { data: existing } = await supabase
      .from("studio_time_entries")
      .select("user_id")
      .eq("id", id)
      .single();
    if (!existing || existing.user_id !== userData.user.id) {
      throw new Error("Solo puedes editar tus propias horas.");
    }
  }

  const hoursRaw = strOrNull(formData.get("hours"));
  const formUserId = strOrNull(formData.get("user_id"));
  // Empleados no pueden re-asignar la imputación a otro usuario.
  const userId = access.isManager ? formUserId : userData.user.id;
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
      kind: parseKind(formData.get("kind")),
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const access = await getProjectAccess(supabase, userData.user.id, projectId);
  if (!access.isManager) {
    const { data: existing } = await supabase
      .from("studio_time_entries")
      .select("user_id")
      .eq("id", id)
      .single();
    if (!existing || existing.user_id !== userData.user.id) {
      throw new Error("Solo puedes borrar tus propias horas.");
    }
  }

  const { error } = await supabase
    .from("studio_time_entries")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/${projectId}`);
}
