"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

/**
 * Guarda la firma manuscrita del usuario actual. Se almacena como base64
 * PNG en `user_profiles.signature_data`. Para que entre en los NDAs el
 * usuario debe ser super_admin (lo selecciona `getPrototipaloSignature`).
 */
export async function saveSignature(
  signatureData: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");

  if (!signatureData || !signatureData.startsWith("data:image/")) {
    return { success: false, error: "Firma no válida" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ signature_data: signatureData })
    .eq("id", profile.id);

  if (error) {
    console.error("[saveSignature] failed:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/signature");
  return { success: true };
}

export async function clearSignature(): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ signature_data: null })
    .eq("id", profile.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings/signature");
  return { success: true };
}
