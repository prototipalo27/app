"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const PATH = "/dashboard/inversores";

// ─── Investors CRUD ───────────────────────────────────────────────

export async function getInvestors() {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investors")
    .select("*")
    .order("equity_pct", { ascending: false });

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}

export async function createInvestor(formData: FormData) {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase.from("investors").insert({
    full_name: formData.get("full_name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    equity_pct: parseFloat(formData.get("equity_pct") as string) || 0,
    invested_amount: parseFloat(formData.get("invested_amount") as string) || 0,
    join_date: (formData.get("join_date") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function updateInvestor(id: string, formData: FormData) {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("investors")
    .update({
      full_name: formData.get("full_name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      equity_pct: parseFloat(formData.get("equity_pct") as string) || 0,
      invested_amount: parseFloat(formData.get("invested_amount") as string) || 0,
      join_date: (formData.get("join_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
      is_active: formData.get("is_active") === "true",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function deleteInvestor(id: string) {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase.from("investors").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

// ─── Quarterly Reports CRUD ───────────────────────────────────────

export async function getQuarterlyReports() {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quarterly_reports")
    .select("*")
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}

export async function upsertQuarterlyReport(formData: FormData) {
  const profile = await requireRole("super_admin");
  const supabase = await createClient();

  const quarter = parseInt(formData.get("quarter") as string);
  const year = parseInt(formData.get("year") as string);

  const payload = {
    quarter,
    year,
    revenue: parseFloat(formData.get("revenue") as string) || 0,
    expenses: parseFloat(formData.get("expenses") as string) || 0,
    net_profit: parseFloat(formData.get("net_profit") as string) || 0,
    cash_balance: parseFloat(formData.get("cash_balance") as string) || 0,
    projects_completed: parseInt(formData.get("projects_completed") as string) || 0,
    new_clients: parseInt(formData.get("new_clients") as string) || 0,
    summary: (formData.get("summary") as string) || null,
    highlights: (formData.get("highlights") as string) || null,
    challenges: (formData.get("challenges") as string) || null,
    next_quarter_goals: (formData.get("next_quarter_goals") as string) || null,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  // Try update first, then insert
  const reportId = formData.get("id") as string;
  if (reportId) {
    const { error } = await supabase
      .from("quarterly_reports")
      .update(payload)
      .eq("id", reportId);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from("quarterly_reports").insert(payload);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function deleteQuarterlyReport(id: string) {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase.from("quarterly_reports").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}
