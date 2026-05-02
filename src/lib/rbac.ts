import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  resolveEffectiveProfile,
  type UserProfile,
  type UserRole,
} from "./auth/resolve-profile";
import { getImpersonatedUserId } from "./impersonate";

export { resolveEffectiveProfile };
export type { UserProfile, UserRole };

const ROLE_HIERARCHY: Record<UserRole, number> = {
  employee: 0,
  comercial: 1,
  manager: 2,
  super_admin: 3,
};

const ALLOWED_DOMAIN = "prototipalo.com";

export function isAllowedDomain(email: string): boolean {
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function getRealProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("id, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  return data as UserProfile;
}

// Lee el perfil que el middleware ya pobló en cabeceras. Sin red.
export async function getUserProfileFromHeaders(): Promise<UserProfile | null> {
  const h = await headers();
  const id = h.get("x-user-id");
  const email = h.get("x-user-email");
  const role = h.get("x-user-role") as UserRole | null;
  const active = h.get("x-user-active");
  if (!id || !email || !role || active === null) return null;
  return { id, email, role, is_active: active === "1" };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  // Fast path: el middleware ya cargó el perfil y lo metió en headers.
  const fromHeaders = await getUserProfileFromHeaders();
  if (fromHeaders) return fromHeaders;

  // Fallback para server actions u otros contextos donde el middleware
  // no haya corrido.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const impersonateId = await getImpersonatedUserId();
  return resolveEffectiveProfile(supabase, user.id, impersonateId);
}

export async function requireRole(minRole: UserRole): Promise<UserProfile> {
  const profile = await getUserProfile();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  if (!hasRole(profile.role, minRole)) {
    redirect("/dashboard");
  }

  return profile;
}
