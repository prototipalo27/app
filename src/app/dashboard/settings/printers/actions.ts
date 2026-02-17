"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateLifetimeHours(formData: FormData) {
  const supabase = await createClient();

  const entries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("hours_")
  );

  for (const [key, value] of entries) {
    const printerId = key.replace("hours_", "");
    const hours = parseFloat(value as string);
    if (isNaN(hours) || hours < 0) continue;

    const seconds = Math.round(hours * 3600);

    const { error } = await supabase
      .from("printers")
      .update({ lifetime_seconds: seconds })
      .eq("id", printerId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath("/dashboard/settings/printers");
  revalidatePath("/dashboard/printers");
  return { success: true };
}
