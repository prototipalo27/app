"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function enqueuePrintJob(formData: FormData) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("Solo managers pueden encolar trabajos de impresión.");
  }

  const labelUrl = (formData.get("label_url") as string | null)?.trim();
  if (!labelUrl) throw new Error("Falta la URL del PDF");
  if (!/^https?:\/\//i.test(labelUrl)) {
    throw new Error("La URL debe empezar por http(s)://");
  }

  const printerLabel =
    (formData.get("printer_label") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("label_print_jobs").insert({
    label_url: labelUrl,
    printer_label: printerLabel,
    source_kind: "manual_test",
    created_by: profile.id,
  });

  if (error) {
    console.error("[print-test] enqueue failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/print-test");
}
