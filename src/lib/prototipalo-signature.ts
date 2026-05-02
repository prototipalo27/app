import { createServiceClient } from "./supabase/server";

/**
 * Devuelve la firma manuscrita de Prototipalo (base64 PNG) o null si
 * todavía no se ha registrado. Por convención es la firma del único
 * super_admin del sistema — quien dispara el envío del NDA es
 * irrelevante: Prototipalo siempre firma con la misma rúbrica.
 */
export async function getPrototipaloSignature(): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("user_profiles")
    .select("signature_data")
    .eq("role", "super_admin")
    .not("signature_data", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.signature_data ?? null;
}
