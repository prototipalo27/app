"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

// ─── Admin: get all event configs ─────────────────────────────────
export async function getNotificationEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_event_config")
    .select("*")
    .order("category, label");

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}

// ─── Admin: update event config ───────────────────────────────────
export async function updateEventConfig(
  eventType: string,
  updates: {
    target_roles?: string[];
    target_user_ids?: string[];
    enabled?: boolean;
  }
) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    return { success: false, error: "No tienes permisos para esta acción" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_event_config")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("event_type", eventType);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings/notifications");
  return { success: true, error: null };
}

// ─── User: get my preferences ─────────────────────────────────────
export async function getMyNotificationPreferences() {
  const profile = await getUserProfile();
  if (!profile) return { success: false, error: "No autenticado", data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("event_type, push_enabled")
    .eq("user_id", profile.id);

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}

// ─── User: toggle a preference ────────────────────────────────────
export async function toggleNotificationPreference(
  eventType: string,
  pushEnabled: boolean
) {
  const profile = await getUserProfile();
  if (!profile) return { success: false, error: "No autenticado" };

  const supabase = await createClient();

  // Upsert: insert or update
  const { error } = await supabase
    .from("user_notification_preferences")
    .upsert(
      {
        user_id: profile.id,
        event_type: eventType,
        push_enabled: pushEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_type" }
    );

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings/notifications");
  return { success: true, error: null };
}

// ─── Admin: get users list for target selection ───────────────────
export async function getActiveUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role")
    .eq("is_active", true)
    .order("email");

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}
