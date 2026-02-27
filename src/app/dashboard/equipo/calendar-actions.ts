"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile, requireRole, hasRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { getSpainHolidays } from "@/lib/holidays/spain";

export async function getHolidays(year: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .eq("year", year)
    .order("date");

  if (error) return [];
  return data;
}

export async function getTimeOffRequests(year: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("*, user:user_profiles!user_id(id, full_name, email), approver:user_profiles!approved_by(full_name)")
    .gte("start_date", `${year}-01-01`)
    .lte("end_date", `${year}-12-31`)
    .order("start_date");

  if (error) return [];
  return data;
}

export async function requestTimeOff(data: {
  startDate: string;
  endDate: string;
  type: string;
  notes?: string;
}) {
  const profile = await getUserProfile();
  if (!profile) return { success: false, error: "No autenticado" };

  const supabase = await createClient();
  const { error } = await supabase.from("time_off_requests").insert({
    user_id: profile.id,
    start_date: data.startDate,
    end_date: data.endDate,
    type: data.type,
    notes: data.notes ?? null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}

export async function approveTimeOff(id: string) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status: "approved",
      approved_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}

export async function rejectTimeOff(id: string) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status: "rejected",
      approved_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}

export async function ensureHolidays(year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("holidays")
    .select("id")
    .eq("year", year)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: true, error: null, message: "Ya existen festivos para este año" };
  }

  const holidays = getSpainHolidays(year);
  const rows = holidays.map((h) => ({
    date: h.date,
    name: h.name,
    scope: h.scope,
    year,
  }));

  const { error } = await supabase.from("holidays").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}
