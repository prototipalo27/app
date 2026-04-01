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

// ─── Report Clients (editable) ────────────────────────────────────

export type ClientProject = {
  name: string;
  description: string;
  value: number;
};

export type ReportClient = {
  id: string;
  report_id: string;
  client_name: string;
  client_email: string | null;
  source: string;
  is_recurring: boolean;
  quarter_value: number;
  lifetime_value: number;
  projects: ClientProject[];
};

export async function getReportClients(reportId: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("quarterly_report_clients")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order");

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data: data as unknown as ReportClient[] };
}

// Auto-populate clients from projects for a given report
export async function populateReportClients(reportId: string, quarter: number, year: number) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  // Check if already populated
  const { count } = await supabase
    .from("quarterly_report_clients")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);

  if (count && count > 0) {
    return { success: false, error: "Ya hay clientes cargados. Elimínalos primero para recargar." };
  }

  // Quarter date range
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1).toISOString();
  const endDate = new Date(year, startMonth + 3, 1).toISOString();

  // Get projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, client_email, lead_id, price, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at");

  if (!projects?.length) return { success: true, error: null };

  // Lead sources
  const leadIds = projects.map((p) => p.lead_id).filter((id): id is string => !!id);
  let leadSourceMap: Record<string, string> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("leads").select("id, source").in("id", leadIds);
    if (leads) leadSourceMap = Object.fromEntries(leads.map((l) => [l.id, l.source]));
  }

  // Recurring check
  const clientEmails = projects.map((p) => p.client_email).filter((e): e is string => !!e);
  let recurringEmails = new Set<string>();
  if (clientEmails.length > 0) {
    const { data: prev } = await supabase
      .from("projects")
      .select("client_email")
      .in("client_email", clientEmails)
      .lt("created_at", startDate);
    if (prev) recurringEmails = new Set(prev.map((p) => p.client_email!).filter(Boolean));
  }

  // Lifetime value per client email
  const lifetimeMap: Record<string, number> = {};
  if (clientEmails.length > 0) {
    const { data: allProjects } = await supabase
      .from("projects")
      .select("client_email, price")
      .in("client_email", clientEmails);
    if (allProjects) {
      for (const p of allProjects) {
        if (p.client_email) {
          lifetimeMap[p.client_email] = (lifetimeMap[p.client_email] || 0) + (p.price || 0);
        }
      }
    }
  }

  // Group by client
  const clientMap = new Map<string, {
    client_name: string;
    client_email: string | null;
    source: string;
    is_recurring: boolean;
    quarter_value: number;
    lifetime_value: number;
    projects: ClientProject[];
  }>();

  for (const p of projects) {
    const key = p.client_email || p.client_name || "Desconocido";
    const source = p.lead_id ? leadSourceMap[p.lead_id] || "directo" : "directo";
    const existing = clientMap.get(key);
    const projectEntry: ClientProject = {
      name: p.name,
      description: "",
      value: p.price || 0,
    };

    if (existing) {
      existing.quarter_value += p.price || 0;
      existing.projects.push(projectEntry);
    } else {
      clientMap.set(key, {
        client_name: p.client_name || "Sin nombre",
        client_email: p.client_email,
        source,
        is_recurring: p.client_email ? recurringEmails.has(p.client_email) : false,
        quarter_value: p.price || 0,
        lifetime_value: p.client_email ? lifetimeMap[p.client_email] || 0 : p.price || 0,
        projects: [projectEntry],
      });
    }
  }

  // Insert all
  const rows = Array.from(clientMap.values()).map((c, i) => ({
    report_id: reportId,
    client_name: c.client_name,
    client_email: c.client_email,
    source: c.source,
    is_recurring: c.is_recurring,
    quarter_value: c.quarter_value,
    lifetime_value: c.lifetime_value,
    projects: JSON.stringify(c.projects),
    sort_order: i,
  }));

  const { error } = await supabase.from("quarterly_report_clients").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function updateReportClient(
  id: string,
  updates: {
    client_name?: string;
    source?: string;
    is_recurring?: boolean;
    quarter_value?: number;
    lifetime_value?: number;
    projects?: ClientProject[];
  }
) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.client_name !== undefined) payload.client_name = updates.client_name;
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.is_recurring !== undefined) payload.is_recurring = updates.is_recurring;
  if (updates.quarter_value !== undefined) payload.quarter_value = updates.quarter_value;
  if (updates.lifetime_value !== undefined) payload.lifetime_value = updates.lifetime_value;
  if (updates.projects !== undefined) payload.projects = JSON.stringify(updates.projects);

  const { error } = await supabase
    .from("quarterly_report_clients")
    .update(payload)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function addReportClient(reportId: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { error } = await supabase.from("quarterly_report_clients").insert({
    report_id: reportId,
    client_name: "Nuevo cliente",
    projects: JSON.stringify([{ name: "Proyecto", description: "", value: 0 }]),
  });

  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function deleteReportClient(id: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { error } = await supabase.from("quarterly_report_clients").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function deleteQuarterlyReport(id: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { error } = await supabase.from("quarterly_reports").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, error: null };
}
