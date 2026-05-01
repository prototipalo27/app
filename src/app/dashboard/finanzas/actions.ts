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
  employee_id?: string | null;
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
    employee_id: data.employee_id ?? null,
    notes: data.notes ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  if (data.employee_id) revalidatePath(`/dashboard/equipo/${data.employee_id}`);
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
    employee_id?: string | null;
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
  if (data.employee_id) revalidatePath(`/dashboard/equipo/${data.employee_id}`);
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

export async function getFixedExpensesByEmployee(employeeId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .order("category")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Tax Payments ──

export async function updateTaxPayment(
  id: string,
  data: {
    status?: string;
    amount?: number | null;
    paid_date?: string | null;
    notes?: string | null;
    clave_liquidacion?: string | null;
    situacion?: string;
    concepto?: string | null;
  }
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

// ── Tax Installments (plazos) ──

export async function getTaxInstallments(taxPaymentId?: string) {
  await requireRole("manager");
  const supabase = await createClient();

  let query = supabase
    .from("tax_installments")
    .select("*")
    .order("numero_plazo");

  if (taxPaymentId) query = query.eq("tax_payment_id", taxPaymentId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTaxInstallment(data: {
  tax_payment_id: string;
  numero_plazo: number;
  fecha_vencimiento: string;
  importe: number;
  pagado?: boolean;
  fecha_pago?: string | null;
  referencia?: string | null;
  notes?: string | null;
}) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("tax_installments")
    .insert({
      tax_payment_id: data.tax_payment_id,
      numero_plazo: data.numero_plazo,
      fecha_vencimiento: data.fecha_vencimiento,
      importe: data.importe,
      pagado: data.pagado ?? false,
      fecha_pago: data.fecha_pago ?? null,
      referencia: data.referencia ?? null,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, data: null };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null, data: inserted };
}

export async function updateTaxInstallment(
  id: string,
  data: {
    numero_plazo?: number;
    fecha_vencimiento?: string;
    importe?: number;
    pagado?: boolean;
    fecha_pago?: string | null;
    referencia?: string | null;
    notes?: string | null;
  }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("tax_installments")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function deleteTaxInstallment(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("tax_installments").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

/** Split a tax payment into N equal installments, starting from a date. */
export async function splitTaxIntoInstallments(
  taxPaymentId: string,
  data: {
    total_amount: number;
    num_installments: number;
    first_due_date: string;
    situacion: "aplazada" | "fraccionada";
  }
) {
  await requireRole("manager");
  const supabase = await createClient();

  if (data.num_installments < 1) {
    return { success: false, error: "Numero de plazos debe ser >= 1" };
  }

  // Equal split; last installment absorbs any rounding remainder
  const per = Math.round((data.total_amount / data.num_installments) * 100) / 100;
  const rows = [] as {
    tax_payment_id: string;
    numero_plazo: number;
    fecha_vencimiento: string;
    importe: number;
  }[];

  const baseDate = new Date(data.first_due_date);
  let running = 0;
  for (let i = 0; i < data.num_installments; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    const importe =
      i === data.num_installments - 1
        ? Math.round((data.total_amount - running) * 100) / 100
        : per;
    running += importe;
    rows.push({
      tax_payment_id: taxPaymentId,
      numero_plazo: i + 1,
      fecha_vencimiento: d.toISOString().split("T")[0],
      importe,
    });
  }

  // Clear existing installments and insert new ones
  const { error: delError } = await supabase
    .from("tax_installments")
    .delete()
    .eq("tax_payment_id", taxPaymentId);
  if (delError) return { success: false, error: delError.message, data: null };

  const { data: inserted, error: insError } = await supabase
    .from("tax_installments")
    .insert(rows)
    .select();
  if (insError) return { success: false, error: insError.message, data: null };

  const { error: updError } = await supabase
    .from("tax_payments")
    .update({
      situacion: data.situacion,
      amount: data.total_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taxPaymentId);
  if (updError) return { success: false, error: updError.message, data: null };

  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null, data: inserted ?? [] };
}

export async function ensureTaxCalendar(year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  const deadlines = getTaxDeadlines(year);

  // Batch upsert: insert all deadlines in one query, skip existing ones
  await supabase.from("tax_payments").upsert(
    deadlines.map((d) => ({
      model: d.model,
      period: d.period,
      due_date: d.dueDate,
      status: "pending",
    })),
    { onConflict: "model,period", ignoreDuplicates: true }
  );

  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

// ── Data fetchers for the page ──

export async function getFixedExpenses() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*, employee:user_profiles!fixed_expenses_employee_id_fkey(id, full_name, nickname, email)")
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

  // Holded invoice status: 0=not paid, 1=paid, 2=partially paid

  const stages: CashFlowStage[] = [
    { key: "quoted", label: "Presupuestado", color: "zinc", total: 0, projects: [] },
    { key: "pending_first", label: "Pendiente 1er 50%", color: "amber", total: 0, projects: [] },
    { key: "collected_first", label: "Cobrado 1er 50%", color: "green", total: 0, projects: [] },
    { key: "pending_second", label: "Pendiente 2do 50%", color: "amber", total: 0, projects: [] },
    { key: "collected", label: "Cobrado", color: "green", total: 0, projects: [] },
  ];

  const nowTs = Math.floor(Date.now() / 1000);

  for (const p of projects ?? []) {
    const price = p.price ?? 0;
    if (price === 0) continue;

    const invoice = p.holded_invoice_id ? invoiceMap.get(p.holded_invoice_id) : null;
    const holdedStatus = invoice?.status ?? null;
    const isShippingOrDelivered = p.status === "shipping" || p.status === "delivered";

    let stageIndex = -1;

    if (p.project_type === "upcoming") {
      // Presupuestado: proforma enviada, cliente aún no ha confirmado
      stageIndex = 0;
    } else if (p.project_type === "confirmed") {
      if (holdedStatus === 1) {
        // Fully paid
        stageIndex = 4;
      } else if (holdedStatus === 2 && isShippingOrDelivered) {
        // Partially paid + in shipping/delivered → pending second 50%
        stageIndex = 3;
      } else if (holdedStatus === 2) {
        // Partially paid, still in production → first 50% collected
        stageIndex = 2;
      } else if (holdedStatus === 0 && isShippingOrDelivered) {
        // Not paid but already shipping/delivered → pending second 50% (they owe everything)
        stageIndex = 3;
      } else {
        // Not paid or no Holded data, in production → pending first 50%
        stageIndex = 1;
      }
    }

    if (stageIndex === -1) continue;

    let daysOverdue: number | null = null;
    if (invoice?.dueDate && invoice.dueDate < nowTs && holdedStatus !== 1) {
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

  // Only show recent paid projects (last 60 days) to not clutter
  const sixtyDaysAgo = nowTs - 60 * 86400;
  stages[4].projects = stages[4].projects.filter((p) => {
    if (!p.holded_due_date) return true;
    return p.holded_due_date > sixtyDaysAgo;
  });
  stages[4].total = stages[4].projects.reduce((s, p) => s + p.price, 0);

  return { stages };
}

// ── Debts (Checklist de deudas) ──

export async function getDebts() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .order("is_paid")
    .order("due_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDebt(data: {
  creditor: string;
  description?: string;
  total_amount: number;
  paid_amount?: number;
  due_date?: string;
  notes?: string;
}) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("debts").insert({
    creditor: data.creditor,
    description: data.description ?? null,
    total_amount: data.total_amount,
    paid_amount: data.paid_amount ?? 0,
    due_date: data.due_date ?? null,
    notes: data.notes ?? null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function updateDebt(
  id: string,
  data: {
    creditor?: string;
    description?: string | null;
    total_amount?: number;
    paid_amount?: number;
    is_paid?: boolean;
    due_date?: string | null;
    notes?: string | null;
  }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("debts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function deleteDebt(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("debts").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/finanzas");
  return { success: true, error: null };
}

export async function getTaxPayments(year?: number) {
  await requireRole("manager");
  const supabase = await createClient();

  let query = supabase
    .from("tax_payments")
    .select("*, installments:tax_installments(*)")
    .order("due_date");

  if (year) {
    query = query.or(`period.like.${year}%,period.like.${year - 1}-Q4`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
