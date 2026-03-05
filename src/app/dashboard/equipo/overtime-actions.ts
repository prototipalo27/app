"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile, getRealProfile, hasRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function getOvertimeBalance(userId?: string) {
  const profile = await getUserProfile();
  if (!profile) return 0;

  const targetId = userId && hasRole(profile.role, "manager") ? userId : profile.id;
  const supabase = await createClient();

  const { data } = await supabase
    .from("overtime_entries")
    .select("minutes, type")
    .eq("user_id", targetId);

  if (!data) return 0;

  return data.reduce((acc, entry) => {
    return acc + (entry.type === "earned" ? entry.minutes : -entry.minutes);
  }, 0);
}

export async function getOvertimeEntries(userId?: string) {
  const profile = await getUserProfile();
  if (!profile) return [];

  const targetId = userId && hasRole(profile.role, "manager") ? userId : profile.id;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("overtime_entries")
    .select("*")
    .eq("user_id", targetId)
    .order("date", { ascending: false });

  if (error) return [];
  return data;
}

export async function getAllOvertimeEntries() {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) return [];

  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from("overtime_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(200);

  if (error || !entries) return [];

  // Get unique user IDs and fetch profiles
  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  return entries.map((e) => ({
    ...e,
    user_profiles: profileMap.get(e.user_id) || null,
  }));
}

export async function addOvertimeEntry(data: {
  date: string;
  minutes: number;
  reason: string;
  type: "earned" | "used";
}) {
  // Use real profile (not impersonated) so auth.uid() matches user_id for RLS
  const profile = await getRealProfile();
  if (!profile) return { success: false, error: "No autenticado" };

  if (!data.reason.trim()) {
    return { success: false, error: "El motivo es obligatorio" };
  }

  if (data.minutes <= 0) {
    return { success: false, error: "El tiempo debe ser mayor que 0" };
  }

  if (data.type === "used") {
    const balance = await getOvertimeBalance();
    if (data.minutes > balance) {
      return { success: false, error: "No tienes suficientes horas disponibles" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("overtime_entries").insert({
    user_id: profile.id,
    date: data.date,
    minutes: data.minutes,
    reason: data.reason.trim(),
    type: data.type,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}

export async function deleteOvertimeEntry(id: string) {
  // Use real profile (not impersonated) so auth.uid() matches for RLS
  const profile = await getRealProfile();
  if (!profile) return { success: false, error: "No autenticado" };

  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("overtime_entries")
    .select("created_at")
    .eq("id", id)
    .eq("user_id", profile.id)
    .single();

  if (!entry) return { success: false, error: "Entrada no encontrada" };

  const createdAt = new Date(entry.created_at!);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return { success: false, error: "Solo se pueden borrar entradas de las ultimas 24h" };
  }

  const { error } = await supabase
    .from("overtime_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}
