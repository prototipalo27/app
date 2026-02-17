import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "super_admin" | "manager" | "employee";

export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  employee: 0,
  manager: 1,
  super_admin: 2,
};

const ALLOWED_DOMAIN = "prototipalo.com";

export function isAllowedDomain(email: string): boolean {
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function getUserProfile(): Promise<UserProfile | null> {
  // Dev bypass: return a mock super_admin profile
  if (process.env.NODE_ENV === "development") {
    return {
      id: "dev-user",
      email: "dev@prototipalo.com",
      role: "super_admin",
      is_active: true,
    };
  }

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
