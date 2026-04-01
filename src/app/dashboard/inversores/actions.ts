"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const PATH = "/dashboard/inversores";

// ─── Investors CRUD ───────────────────────────────────────────────

export async function getInvestors() {
  await requireRole("super_admin");
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("investors")
    .select("*")
    .order("equity_pct", { ascending: false });

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data };
}

export async function createInvestor(formData: FormData) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

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
  const supabase = createServiceClient();

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
  const supabase = createServiceClient();

  const { error } = await supabase.from("investors").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

// ─── Quarterly Reports CRUD ───────────────────────────────────────

export async function getQuarterlyReports() {
  await requireRole("super_admin");
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();

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

// ─── Auto-calculated client data for a quarter ───────────────────

export type QuarterClient = {
  client_name: string;
  client_email: string | null;
  source: string;
  is_recurring: boolean;
  project_count: number;
  project_names: string[];
};

export async function getQuarterClients(quarter: number, year: number) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  // Quarter date range
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const startDate = new Date(year, startMonth, 1).toISOString();
  const endDate = new Date(year, startMonth + 3, 1).toISOString();

  // Get projects created in this quarter with their lead source
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, client_email, lead_id, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: false });

  if (!projects?.length) return { success: true, data: [] };

  // Get lead sources for these projects
  const leadIds = projects
    .map((p) => p.lead_id)
    .filter((id): id is string => !!id);

  let leadSourceMap: Record<string, string> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, source")
      .in("id", leadIds);

    if (leads) {
      leadSourceMap = Object.fromEntries(leads.map((l) => [l.id, l.source]));
    }
  }

  // Check which clients are recurring (have projects BEFORE this quarter)
  const clientEmails = projects
    .map((p) => p.client_email)
    .filter((e): e is string => !!e);

  let recurringEmails = new Set<string>();
  if (clientEmails.length > 0) {
    const { data: previousProjects } = await supabase
      .from("projects")
      .select("client_email")
      .in("client_email", clientEmails)
      .lt("created_at", startDate);

    if (previousProjects) {
      recurringEmails = new Set(
        previousProjects.map((p) => p.client_email!).filter(Boolean)
      );
    }
  }

  // Group by client
  const clientMap = new Map<string, QuarterClient>();
  for (const p of projects) {
    const key = p.client_email || p.client_name || "Desconocido";
    const existing = clientMap.get(key);
    const source = p.lead_id ? leadSourceMap[p.lead_id] || "directo" : "directo";

    if (existing) {
      existing.project_count++;
      existing.project_names.push(p.name);
    } else {
      clientMap.set(key, {
        client_name: p.client_name || "Sin nombre",
        client_email: p.client_email,
        source,
        is_recurring: p.client_email ? recurringEmails.has(p.client_email) : false,
        project_count: 1,
        project_names: [p.name],
      });
    }
  }

  return { success: true, data: Array.from(clientMap.values()) };
}

export async function deleteQuarterlyReport(id: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { error } = await supabase.from("quarterly_reports").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}
