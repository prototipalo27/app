"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { CATEGORY_LABELS } from "@/lib/finance/categories";

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

  const { randomBytes } = await import("crypto");
  const token = randomBytes(24).toString("hex");

  const { error } = await supabase.from("investors").insert({
    full_name: formData.get("full_name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    equity_pct: parseFloat(formData.get("equity_pct") as string) || 0,
    invested_amount: parseFloat(formData.get("invested_amount") as string) || 0,
    join_date: (formData.get("join_date") as string) || null,
    notes: (formData.get("notes") as string) || null,
    access_token: token,
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
    video_url: (formData.get("video_url") as string) || null,
    published: formData.get("published") === "true",
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

  // Quarter date range as unix timestamps (Holded uses seconds)
  const startMonth = (quarter - 1) * 3;
  const startUnix = Math.floor(new Date(year, startMonth, 1).getTime() / 1000);
  const endUnix = Math.floor(new Date(year, startMonth + 3, 1).getTime() / 1000);

  // Fetch invoices + credit notes from Holded for this quarter
  const { listDocuments } = await import("@/lib/holded/api");
  const [invoices, creditNotes] = await Promise.all([
    listDocuments("invoice", { starttmp: startUnix, endtmp: endUnix }),
    listDocuments("creditnote", { starttmp: startUnix, endtmp: endUnix }),
  ]);

  if (!invoices.length && !creditNotes.length) {
    return { success: true, error: `No se encontraron facturas en Holded para Q${quarter} ${year}` };
  }

  // Build credit note map by contact for easy matching
  const creditByContact: Record<string, typeof creditNotes> = {};
  for (const cn of creditNotes) {
    if (!creditByContact[cn.contact]) creditByContact[cn.contact] = [];
    creditByContact[cn.contact].push(cn);
  }

  // Lifetime value: fetch ALL invoices since 2022 per contact
  const contactIds = [...new Set(invoices.map((inv) => inv.contact))];
  const since2022 = Math.floor(new Date(2022, 0, 1).getTime() / 1000);
  const [allInvoices, allCreditNotes] = await Promise.all([
    listDocuments("invoice", { starttmp: since2022 }),
    listDocuments("creditnote", { starttmp: since2022 }),
  ]);

  const lifetimeMap: Record<string, number> = {};
  for (const inv of allInvoices) {
    lifetimeMap[inv.contact] = (lifetimeMap[inv.contact] || 0) + inv.subtotal;
  }
  for (const cn of allCreditNotes) {
    lifetimeMap[cn.contact] = (lifetimeMap[cn.contact] || 0) - cn.subtotal;
  }

  // Recurring: contacts that had invoices BEFORE this quarter
  const recurringContacts = new Set<string>();
  for (const inv of allInvoices) {
    if (inv.date < startUnix && contactIds.includes(inv.contact)) {
      recurringContacts.add(inv.contact);
    }
  }

  // Try to match contacts to leads for source info
  const leadSourceMap: Record<string, string> = {};
  const { data: leads } = await supabase
    .from("leads")
    .select("email, source, company")
    .in("status", ["won", "paid"]);
  if (leads) {
    for (const l of leads) {
      if (l.email) leadSourceMap[l.email.toLowerCase()] = l.source || "directo";
      if (l.company) leadSourceMap[l.company.toLowerCase()] = l.source || "directo";
    }
  }

  // Group invoices by contact
  const clientMap = new Map<string, {
    client_name: string;
    contact_id: string;
    source: string;
    is_recurring: boolean;
    quarter_value: number;
    lifetime_value: number;
    projects: ClientProject[];
  }>();

  // ── Match & cancel: pair invoices with credit notes by contact + amount ──
  // Group credit notes by contact for matching
  const remainingCreditNotes: Record<string, typeof creditNotes> = {};
  for (const cn of creditNotes) {
    if (!remainingCreditNotes[cn.contact]) remainingCreditNotes[cn.contact] = [];
    remainingCreditNotes[cn.contact].push({ ...cn });
  }

  // Filter invoices: remove those that are fully cancelled by a credit note
  const cleanInvoices = invoices.filter((inv) => {
    const contactCNs = remainingCreditNotes[inv.contact];
    if (!contactCNs?.length) return true;

    // Find a credit note with matching total
    const matchIdx = contactCNs.findIndex((cn) => Math.abs(cn.subtotal - inv.subtotal) < 0.01);
    if (matchIdx >= 0) {
      // Remove the matched credit note so it's not reused
      contactCNs.splice(matchIdx, 1);
      return false; // Cancel this invoice
    }
    return true;
  });

  // Remaining credit notes that didn't match any invoice
  const unmatchedCreditNotes = Object.values(remainingCreditNotes).flat();

  for (const inv of cleanInvoices) {
    const key = inv.contact;
    const existing = clientMap.get(key);

    const nameLower = inv.contactName.toLowerCase();
    const source = leadSourceMap[nameLower] || "directo";

    const projectEntry: ClientProject = {
      name: `${inv.docNumber} — ${inv.products?.map((p) => p.name).join(", ") || inv.desc || "Factura"}`,
      description: "",
      value: inv.subtotal,
    };

    if (existing) {
      existing.quarter_value += inv.subtotal;
      existing.projects.push(projectEntry);
    } else {
      clientMap.set(key, {
        client_name: inv.contactName,
        contact_id: inv.contact,
        source,
        is_recurring: recurringContacts.has(inv.contact),
        quarter_value: inv.subtotal,
        lifetime_value: lifetimeMap[inv.contact] || inv.subtotal,
        projects: [projectEntry],
      });
    }
  }

  // Add unmatched credit notes (partial refunds, etc.)
  for (const cn of unmatchedCreditNotes) {
    const key = cn.contact;
    const existing = clientMap.get(key);

    const rectEntry: ClientProject = {
      name: `${cn.docNumber} (Rectificativa)`,
      description: "",
      value: -cn.subtotal,
    };

    if (existing) {
      existing.quarter_value -= cn.subtotal;
      existing.projects.push(rectEntry);
    } else {
      clientMap.set(key, {
        client_name: cn.contactName,
        contact_id: cn.contact,
        source: "directo",
        is_recurring: true,
        quarter_value: -cn.subtotal,
        lifetime_value: lifetimeMap[cn.contact] || 0,
        projects: [rectEntry],
      });
    }
  }

  // Remove clients with zero or negative net value (fully cancelled)
  for (const [key, client] of clientMap) {
    if (client.quarter_value <= 0) clientMap.delete(key);
  }

  // Insert all
  const rows = Array.from(clientMap.values()).map((c, i) => ({
    report_id: reportId,
    client_name: c.client_name,
    client_email: null,
    source: c.source,
    is_recurring: c.is_recurring,
    quarter_value: c.quarter_value,
    lifetime_value: c.lifetime_value,
    projects: JSON.stringify(c.projects),
    sort_order: i,
  }));

  const { error } = await supabase.from("quarterly_report_clients").insert(rows);
  if (error) return { success: false, error: error.message };

  // Auto-update revenue on the quarterly report
  const totalRevenue = rows.reduce((sum, r) => sum + r.quarter_value, 0);
  const totalClients = rows.length;
  const newClientsCount = rows.filter((r) => !r.is_recurring).length;
  await supabase
    .from("quarterly_reports")
    .update({
      revenue: totalRevenue,
      new_clients: newClientsCount,
      projects_completed: rows.reduce((sum, r) => sum + ((JSON.parse(r.projects as string) as ClientProject[]).length), 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

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

// ─── Report Expenses (from bank statements) ─────────────────────

export type ExpenseDetail = {
  vendor: string;
  amount: number;
};

export type ReportExpense = {
  id: string;
  report_id: string;
  category: string;
  amount: number;
  vendor_count: number;
  details: ExpenseDetail[];
};

export async function getReportExpenses(reportId: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("quarterly_report_expenses")
    .select("*")
    .eq("report_id", reportId)
    .order("amount", { ascending: false });

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, error: null, data: data as unknown as ReportExpense[] };
}

export async function populateReportExpenses(reportId: string, quarter: number, year: number) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  // Check if already populated
  const { count } = await supabase
    .from("quarterly_report_expenses")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);

  if (count && count > 0) {
    return { success: false, error: "Ya hay gastos cargados. Elimínalos primero para recargar." };
  }

  // Get the 3 months of the quarter
  const months = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3];

  // Fetch bank statements for these months
  const { data: statements } = await supabase
    .from("bank_statements")
    .select("transactions")
    .eq("year", year)
    .in("month", months);

  if (!statements || statements.length === 0) {
    return { success: true, error: `No se encontraron extractos bancarios para Q${quarter} ${year}` };
  }

  // Fetch vendor mappings for category assignment
  const { data: mappings } = await supabase
    .from("vendor_mappings")
    .select("bank_vendor_name, category");

  const categoryMap: Record<string, string> = {};
  if (mappings) {
    for (const m of mappings) {
      categoryMap[m.bank_vendor_name.toLowerCase()] = m.category || "other";
    }
  }

  // Process all transactions: group expenses by category
  type VendorSum = { vendor: string; amount: number };
  const categoryTotals: Record<string, { amount: number; vendors: Record<string, number> }> = {};

  for (const stmt of statements) {
    const transactions = stmt.transactions as Array<{
      amount: string;
      vendorName?: string;
      description?: string;
    }>;

    for (const tx of transactions) {
      // BBVA format: dot with exactly 3 digits after = thousands separator (e.g. -1.318 = -1318)
      // dot with 1-2 digits after = decimal (e.g. -191.18 = -191.18, -1.95 = -1.95)
      const raw = String(tx.amount);
      const amount = parseFloat(raw.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
      if (amount >= 0) continue; // Only expenses (negative amounts)

      const vendor = tx.vendorName || tx.description || "Desconocido";
      const category = categoryMap[vendor.toLowerCase()] || "other";
      const absAmount = Math.abs(amount);

      if (!categoryTotals[category]) {
        categoryTotals[category] = { amount: 0, vendors: {} };
      }
      categoryTotals[category].amount += absAmount;
      categoryTotals[category].vendors[vendor] = (categoryTotals[category].vendors[vendor] || 0) + absAmount;
    }
  }

  // Build rows sorted by amount desc
  const rows = Object.entries(categoryTotals)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, data], i) => {
      const details: VendorSum[] = Object.entries(data.vendors)
        .sort((a, b) => b[1] - a[1])
        .map(([vendor, amount]) => ({ vendor, amount: Math.round(amount * 100) / 100 }));

      return {
        report_id: reportId,
        category,
        amount: Math.round(data.amount * 100) / 100,
        vendor_count: details.length,
        details: JSON.stringify(details),
        sort_order: i,
      };
    });

  if (rows.length === 0) {
    return { success: true, error: "No se encontraron gastos en los extractos." };
  }

  const { error } = await supabase.from("quarterly_report_expenses").insert(rows);
  if (error) return { success: false, error: error.message };

  // Auto-update expenses total on the quarterly report
  const totalExpenses = rows.reduce((sum, r) => sum + r.amount, 0);
  await supabase
    .from("quarterly_reports")
    .update({
      expenses: totalExpenses,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  revalidatePath(PATH);
  return { success: true, error: null };
}

export async function updateReportExpense(
  id: string,
  updates: { category?: string; amount?: number }
) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.amount !== undefined) payload.amount = updates.amount;

  const { error } = await supabase
    .from("quarterly_report_expenses")
    .update(payload)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteReportExpenses(reportId: string) {
  await requireRole("super_admin");
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("quarterly_report_expenses")
    .delete()
    .eq("report_id", reportId);

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
