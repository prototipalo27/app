"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { listDocuments } from "@/lib/holded/api";
import { getTaxDeadlines } from "@/lib/finance/tax-calendar";

// ── Fixed Expenses CRUD ──

export async function createFixedExpense(data: {
  name: string;
  category: string;
  amount: number;
  frequency: string;
  day_of_month?: number;
  bank_vendor_name?: string;
  supplier_id?: string;
  notes?: string;
  start_date?: string;
  end_date?: string | null;
}) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("fixed_expenses").insert({
    name: data.name,
    category: data.category,
    amount: data.amount,
    frequency: data.frequency,
    day_of_month: data.day_of_month ?? null,
    bank_vendor_name: data.bank_vendor_name ?? null,
    supplier_id: data.supplier_id ?? null,
    notes: data.notes ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function updateFixedExpense(
  id: string,
  data: {
    name?: string;
    category?: string;
    amount?: number;
    frequency?: string;
    day_of_month?: number | null;
    bank_vendor_name?: string | null;
    supplier_id?: string | null;
    notes?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("fixed_expenses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function deactivateFixedExpense(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("fixed_expenses")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

// ── Tax Payments ──

export async function updateTaxPayment(
  id: string,
  data: { status?: string; amount?: number; paid_date?: string; notes?: string }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("tax_payments")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function ensureTaxCalendar(year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  const deadlines = getTaxDeadlines(year);

  for (const d of deadlines) {
    const { data: existing } = await supabase
      .from("tax_payments")
      .select("id")
      .eq("model", d.model)
      .eq("period", d.period)
      .maybeSingle();

    if (!existing) {
      await supabase.from("tax_payments").insert({
        model: d.model,
        period: d.period,
        due_date: d.dueDate,
        status: "pending",
      });
    }
  }

  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

// ── Holded — Pending Invoices ──

export async function getPendingInvoices() {
  await requireRole("manager");

  try {
    const invoices = await listDocuments("invoice");
    // Holded status: 0=draft, 1=not paid, 2=paid, 3=partially paid, 4=overdue
    // Only show truly unpaid: 1 (not paid), 3 (partially paid), 4 (overdue)
    const pending = invoices.filter((inv) => inv.status === 1 || inv.status === 3 || inv.status === 4);
    return pending.map((inv) => ({
      id: inv.id,
      contactName: inv.contactName,
      docNumber: inv.docNumber,
      total: inv.total,
      dueDate: inv.dueDate,
      date: inv.date,
      status: inv.status,
    }));
  } catch {
    return [];
  }
}

/** Debug: get all invoice statuses to diagnose filtering issues */
export async function debugInvoiceStatuses() {
  await requireRole("manager");

  try {
    const invoices = await listDocuments("invoice");
    const statusCounts: Record<number, number> = {};
    for (const inv of invoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    }
    // Return summary + last 10 invoices for inspection
    return {
      total: invoices.length,
      statusCounts,
      sample: invoices.slice(0, 15).map((inv) => ({
        docNumber: inv.docNumber,
        contactName: inv.contactName,
        total: inv.total,
        status: inv.status,
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Data fetchers for the page ──

export async function getFixedExpenses() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

// ── Financings CRUD ──

export async function createFinancing(data: {
  name: string;
  category: string;
  total_amount: number;
  monthly_payment: number;
  total_installments: number;
  paid_installments?: number;
  interest_rate?: number;
  start_date: string;
  end_date: string;
  bank_vendor_name?: string;
  notes?: string;
}) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("financings").insert({
    name: data.name,
    category: data.category,
    total_amount: data.total_amount,
    monthly_payment: data.monthly_payment,
    total_installments: data.total_installments,
    paid_installments: data.paid_installments ?? 0,
    interest_rate: data.interest_rate ?? null,
    start_date: data.start_date,
    end_date: data.end_date,
    bank_vendor_name: data.bank_vendor_name ?? null,
    notes: data.notes ?? null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function updateFinancing(
  id: string,
  data: {
    name?: string;
    category?: string;
    total_amount?: number;
    monthly_payment?: number;
    total_installments?: number;
    paid_installments?: number;
    interest_rate?: number | null;
    start_date?: string;
    end_date?: string;
    bank_vendor_name?: string | null;
    notes?: string | null;
  }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("financings")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function deactivateFinancing(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("financings")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function getFinancings() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financings")
    .select("*")
    .eq("is_active", true)
    .order("end_date");

  if (error) throw new Error(error.message);
  return data;
}

// ── Cash Flow Pipeline ──

export type CashFlowProject = {
  id: string;
  name: string;
  client_name: string | null;
  price: number;
  holded_doc_number: string | null;
  holded_due_date: number | null;
  days_overdue: number | null;
};

export type CashFlowStage = {
  key: string;
  label: string;
  color: "zinc" | "amber" | "green" | "red";
  total: number;
  projects: CashFlowProject[];
};

export async function getCashFlowPipeline(): Promise<{ stages: CashFlowStage[] }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, price, project_type, status, proforma_sent_at, holded_invoice_id, payment_confirmed_at")
    .in("project_type", ["upcoming", "confirmed"]);

  let invoiceMap = new Map<string, { status: number; docNumber: string; dueDate: number }>();
  try {
    const invoices = await listDocuments("invoice");
    for (const inv of invoices) {
      invoiceMap.set(inv.id, {
        status: inv.status,
        docNumber: inv.docNumber,
        dueDate: inv.dueDate,
      });
    }
  } catch {
    // Holded API error — continue with local data only
  }

  const stages: CashFlowStage[] = [
    { key: "quoted", label: "Presupuestado", color: "zinc", total: 0, projects: [] },
    { key: "pending_first", label: "Pendiente 1er 50%", color: "amber", total: 0, projects: [] },
    { key: "collected_first", label: "Cobrado 1er 50%", color: "green", total: 0, projects: [] },
    { key: "pending_second", label: "Pendiente 2do 50%", color: "amber", total: 0, projects: [] },
    { key: "owed_delivered", label: "Entregado, nos deben", color: "red", total: 0, projects: [] },
  ];

  const nowTs = Math.floor(Date.now() / 1000);

  for (const p of projects ?? []) {
    const price = p.price ?? 0;
    const invoice = p.holded_invoice_id ? invoiceMap.get(p.holded_invoice_id) : null;
    const holdedStatus = invoice?.status ?? null;

    // Skip fully paid projects (Holded status 2)
    if (holdedStatus === 2) continue;

    const isDelivered = p.status === "delivered";
    const isShippingOrDelivered = p.status === "shipping" || p.status === "delivered";

    let stageIndex = -1;

    if (p.project_type === "upcoming" && p.proforma_sent_at) {
      // Stage 1: Presupuestado
      stageIndex = 0;
    } else if (p.project_type === "confirmed") {
      if (holdedStatus !== null) {
        // We have Holded data
        if ((holdedStatus === 1 || holdedStatus === 4) && isDelivered) {
          // Stage 5: Delivered but unpaid/overdue
          stageIndex = 4;
        } else if (holdedStatus === 3 && isShippingOrDelivered) {
          // Stage 4: Partially paid + shipping/delivered
          stageIndex = 3;
        } else if (holdedStatus === 3) {
          // Stage 3: Partially paid, still in production
          stageIndex = 2;
        } else if (holdedStatus === 1 || holdedStatus === 4) {
          // Stage 2: Not paid, in production
          stageIndex = 1;
        }
      } else {
        // No Holded data — use payment_confirmed_at as fallback
        if (p.payment_confirmed_at && isShippingOrDelivered) {
          stageIndex = 3;
        } else if (p.payment_confirmed_at) {
          stageIndex = 2;
        } else {
          stageIndex = 1;
        }
      }
    }

    if (stageIndex === -1) continue;

    let daysOverdue: number | null = null;
    if (invoice?.dueDate && invoice.dueDate < nowTs) {
      daysOverdue = Math.floor((nowTs - invoice.dueDate) / 86400);
    }

    stages[stageIndex].total += price;
    stages[stageIndex].projects.push({
      id: p.id,
      name: p.name,
      client_name: p.client_name,
      price,
      holded_doc_number: invoice?.docNumber ?? null,
      holded_due_date: invoice?.dueDate ?? null,
      days_overdue: daysOverdue,
    });
  }

  return { stages };
}

export async function getTaxPayments(year?: number) {
  await requireRole("manager");
  const supabase = await createClient();

  let query = supabase
    .from("tax_payments")
    .select("*")
    .order("due_date");

  if (year) {
    query = query.or(`period.like.${year}%,period.like.${year - 1}-Q4`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
