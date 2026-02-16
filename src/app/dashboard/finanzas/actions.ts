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
    const pending = invoices.filter((inv) => inv.status === 1 || inv.status === 3);
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

// ── Data fetchers for the page ──

export async function getFixedExpenses() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
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
