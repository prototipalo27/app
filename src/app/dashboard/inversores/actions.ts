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

  // Find lead IDs from activity log where status changed to "won" or "paid"
  const [{ data: wonAct1 }, { data: wonAct2 }, { data: leadsWithWonAt }] = await Promise.all([
    supabase
      .from("lead_activities")
      .select("lead_id")
      .eq("activity_type", "status_change")
      .ilike("content", "%a won")
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    supabase
      .from("lead_activities")
      .select("lead_id")
      .eq("activity_type", "status_change")
      .ilike("content", "%a paid")
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    supabase
      .from("leads")
      .select("id")
      .in("status", ["won", "paid"])
      .not("won_at", "is", null)
      .gte("won_at", startDate)
      .lt("won_at", endDate),
  ]);

  const allWonIds = [...new Set([
    ...(wonAct1 || []).map((a) => a.lead_id),
    ...(wonAct2 || []).map((a) => a.lead_id),
    ...(leadsWithWonAt || []).map((l) => l.id),
  ])];

  if (!allWonIds.length) return { success: true, error: `No se encontraron leads ganados en Q${quarter} ${year} (${startDate.slice(0,10)} → ${endDate.slice(0,10)})` };

  // Fetch full lead data
  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, full_name, email, source, won_at, updated_at")
    .in("id", allWonIds);

  if (!wonLeads?.length) return { success: true, error: `No se encontraron leads ganados en Q${quarter} ${year}` };

  // Get projects linked to these leads
  const leadIds = wonLeads.map((l) => l.id);
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, client_email, lead_id, price")
    .in("lead_id", leadIds);

  // Build lead→source and lead→projects maps
  const leadSourceMap: Record<string, string> = {};
  const leadProjectsMap: Record<string, typeof projects> = {};
  for (const l of wonLeads) {
    leadSourceMap[l.id] = l.source || "directo";
    leadProjectsMap[l.id] = [];
  }
  for (const p of projects || []) {
    if (p.lead_id) leadProjectsMap[p.lead_id]?.push(p);
  }

  // Recurring check: same email had a won/paid activity BEFORE this quarter
  const leadEmails = wonLeads.map((l) => l.email).filter((e): e is string => !!e);
  let recurringEmails = new Set<string>();
  if (leadEmails.length > 0) {
    const [{ data: prev1 }, { data: prev2 }] = await Promise.all([
      supabase
        .from("lead_activities")
        .select("lead_id")
        .eq("activity_type", "status_change")
        .ilike("content", "%a won")
        .lt("created_at", startDate),
      supabase
        .from("lead_activities")
        .select("lead_id")
        .eq("activity_type", "status_change")
        .ilike("content", "%a paid")
        .lt("created_at", startDate),
    ]);
    const prevActivities = [...(prev1 || []), ...(prev2 || [])];

    if (prevActivities?.length) {
      const prevLeadIds = [...new Set(prevActivities.map((a) => a.lead_id))];
      const { data: prevLeads } = await supabase
        .from("leads")
        .select("email")
        .in("id", prevLeadIds)
        .in("email", leadEmails);
      if (prevLeads) recurringEmails = new Set(prevLeads.map((l) => l.email!).filter(Boolean));
    }
  }

  // Lifetime value: sum of price for ALL projects per client email
  const lifetimeMap: Record<string, number> = {};
  if (leadEmails.length > 0) {
    const { data: allProjects } = await supabase
      .from("projects")
      .select("client_email, price")
      .in("client_email", leadEmails);
    if (allProjects) {
      for (const p of allProjects) {
        if (p.client_email) {
          lifetimeMap[p.client_email] = (lifetimeMap[p.client_email] || 0) + (p.price || 0);
        }
      }
    }
  }

  // Group by lead (each won lead = one client row)
  const clientMap = new Map<string, {
    client_name: string;
    client_email: string | null;
    source: string;
    is_recurring: boolean;
    quarter_value: number;
    lifetime_value: number;
    projects: ClientProject[];
  }>();

  for (const lead of wonLeads) {
    const leadProjects = leadProjectsMap[lead.id] || [];
    const quarterValue = leadProjects.reduce((s, p) => s + (p.price || 0), 0);
    const clientProjects: ClientProject[] = leadProjects.length > 0
      ? leadProjects.map((p) => ({ name: p.name, description: "", value: p.price || 0 }))
      : [{ name: "Sin proyecto asociado", description: "", value: 0 }];

    const key = lead.email || lead.id;
    const existing = clientMap.get(key);
    if (existing) {
      existing.quarter_value += quarterValue;
      existing.projects.push(...clientProjects);
    } else {
      clientMap.set(key, {
        client_name: lead.full_name || "Sin nombre",
        client_email: lead.email,
        source: lead.source || "directo",
        is_recurring: lead.email ? recurringEmails.has(lead.email) : false,
        quarter_value: quarterValue,
        lifetime_value: lead.email ? lifetimeMap[lead.email] || 0 : quarterValue,
        projects: clientProjects,
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
