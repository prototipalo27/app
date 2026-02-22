"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRealProfile } from "./rbac";

const COOKIE_NAME = "x-impersonate-user-id";

export async function startImpersonating(userId: string) {
  const realProfile = await getRealProfile();
  if (!realProfile || realProfile.role !== "super_admin") {
    return { success: false, error: "No autorizado" };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function stopImpersonating() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function getImpersonatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
