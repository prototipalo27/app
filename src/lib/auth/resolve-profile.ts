import { type SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "super_admin" | "manager" | "comercial" | "employee";

export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

// Único punto donde vive la lógica de impersonación: la usan tanto el
// middleware como el fallback de getUserProfile. Devuelve null SOLO si el
// usuario autenticado no tiene fila en user_profiles (estado inconsistente).
// Si la impersonación apunta a un id inexistente, cae al perfil real.
export async function resolveEffectiveProfile(
  supabase: SupabaseClient,
  userId: string,
  impersonateId: string | null,
): Promise<UserProfile | null> {
  const { data: realProfile } = await supabase
    .from("user_profiles")
    .select("id, email, role, is_active")
    .eq("id", userId)
    .single();

  if (!realProfile) return null;

  if (
    realProfile.role === "super_admin" &&
    impersonateId &&
    impersonateId !== realProfile.id
  ) {
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("id, email, role, is_active")
      .eq("id", impersonateId)
      .single();
    if (targetProfile) return targetProfile as UserProfile;
  }

  return realProfile as UserProfile;
}
