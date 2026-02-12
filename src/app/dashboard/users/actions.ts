"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/rbac";

const PROTECTED_EMAIL = "manu@prototipalo.com";

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
  return { message: `Invitacion enviada a ${email}` };
}
