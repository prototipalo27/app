"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath, updateTag } from "next/cache";
import type { UserRole } from "@/lib/rbac";

const PROTECTED_EMAIL = "manu@prototipalo.com";
const PROTECTED_EMAILS = ["manu@prototipalo.com"];

export async function updateUserRole(userId: string, role: UserRole) {
  const profile = await requireRole("super_admin");

  // Cannot change own role
  if (userId === profile.id) {
    throw new Error("No puedes cambiar tu propio rol");
  }

  const supabase = await createClient();

  // Protect manu@prototipalo.com from role changes
  const { data: target } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (target?.email === PROTECTED_EMAIL) {
    throw new Error("No se puede cambiar el rol de este usuario");
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/users");
  updateTag("user-profiles");
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const profile = await requireRole("super_admin");

  // Cannot deactivate self
  if (userId === profile.id) {
    throw new Error("No puedes desactivarte a ti mismo");
  }

  const supabase = await createClient();

  // Protect manu@prototipalo.com
  const { data: target } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (target?.email === PROTECTED_EMAIL) {
    throw new Error("No se puede desactivar a este usuario");
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/users");
  updateTag("user-profiles");
}

export async function inviteUser(
  _prevState: { error?: string; message?: string } | null,
  formData: FormData
) {
  await requireRole("super_admin");

  const email = formData.get("email") as string;

  if (!email?.endsWith("@prototipalo.com")) {
    return { error: "Solo se pueden invitar emails @prototipalo.com" };
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/users");
  updateTag("user-profiles");
  return { message: `Invitacion enviada a ${email}` };
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("super_admin");

  if (userId === profile.id) {
    return { success: false, error: "No puedes eliminarte a ti mismo" };
  }

  const supabase = await createClient();

  // Check protected
  const { data: target } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!target) return { success: false, error: "Usuario no encontrado" };
  if (PROTECTED_EMAILS.includes(target.email)) {
    return { success: false, error: "No se puede eliminar a este usuario" };
  }

  // Delete from Supabase Auth (cascades to profile via trigger/FK)
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.deleteUser(userId);

  if (error) return { success: false, error: error.message };

  // Also delete profile row if it wasn't cascaded
  await supabase.from("user_profiles").delete().eq("id", userId);

  revalidatePath("/dashboard/users");
  updateTag("user-profiles");
  return { success: true };
}

export async function updateContractEndDate(
  userId: string,
  contractEndDate: string | null,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      contract_end_date: contractEndDate || null,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/users");
  updateTag("user-profiles");
  return { success: true };
}
