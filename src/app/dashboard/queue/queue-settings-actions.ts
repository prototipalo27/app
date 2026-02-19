"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateLaunchSettings(
  startTime: string,
  endTime: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  // Validate format HH:MM
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { success: false, error: "Formato de hora invalido" };
  }

  const { error: e1 } = await supabase
    .from("app_metadata")
    .upsert({ key: "launch_start_time", value: startTime, updated_at: new Date().toISOString() });
  const { error: e2 } = await supabase
    .from("app_metadata")
    .upsert({ key: "launch_end_time", value: endTime, updated_at: new Date().toISOString() });

  if (e1 || e2) {
    return { success: false, error: (e1 ?? e2)!.message };
  }

  revalidatePath("/dashboard/queue");
  return { success: true };
}
