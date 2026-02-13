"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
import { getOrCreateSubfolder } from "@/lib/google-drive/client";

const INVOICES_DRIVE_PARENT = "1bzQ0UaPk3VDltG3hyX--cHTRqJYJRczV";

export async function getSuppliers() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, email")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getVendorMappings() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendor_mappings")
    .select("id, bank_vendor_name, supplier_id");

  if (error) throw new Error(error.message);
  return data;
}

export async function saveVendorMapping(bankVendorName: string, supplierId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("vendor_mappings")
    .upsert(
      { bank_vendor_name: bankVendorName, supplier_id: supplierId },
      { onConflict: "bank_vendor_name" }
    );

  if (error) throw new Error(error.message);
}

export async function saveVendorMappingsBatch(
  mappings: { bankVendorName: string; supplierId: string }[]
) {
  await requireRole("manager");
  const supabase = await createClient();

  const rows = mappings.map((m) => ({
    bank_vendor_name: m.bankVendorName,
    supplier_id: m.supplierId,
  }));

  const { error } = await supabase
    .from("vendor_mappings")
    .upsert(rows, { onConflict: "bank_vendor_name" });

  if (error) throw new Error(error.message);
}

interface ClaimTransaction {
  date: string;
  description: string;
  amount: number;
}

export async function sendClaimEmail(
  supplierId: string,
  email: string,
  supplierName: string,
  transactions: ClaimTransaction[],
  totalAmount: number
) {
  await requireRole("manager");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) throw new Error("No autenticado");

  // Build email content
  const lines = [
    `Estimado/a ${supplierName},`,
    "",
    "Estamos revisando nuestros pagos y nos consta que se han realizado los siguientes cargos para los que no disponemos de la factura correspondiente:",
    "",
  ];

  transactions.forEach((t, i) => {
    lines.push(
      `${i + 1}. ${t.date} — ${Math.abs(t.amount).toFixed(2)}€ — ${t.description}`
    );
  });

  lines.push("");
  lines.push(`Total: ${Math.abs(totalAmount).toFixed(2)}€`);
  lines.push("");
  lines.push(
    "Por favor, enviadnos las facturas correspondientes a la mayor brevedad."
  );
  lines.push("");
  lines.push("Gracias,");
  lines.push("Prototipalo");

  const text = lines.join("\n");

  const htmlLines = lines.map((l) => {
    if (l === "") return "<br/>";
    if (/^\d+\./.test(l)) return `<p style="margin:2px 0;padding-left:16px;">${l}</p>`;
    if (l.startsWith("Total:")) return `<p><strong>${l}</strong></p>`;
    return `<p>${l}</p>`;
  });
  const html = htmlLines.join("\n");

  // Send email
  await sendEmail({
    to: email,
    subject: `Solicitud de facturas pendientes — Prototipalo`,
    text,
    html,
  });

  // Register claim in database
  const { error } = await supabase.from("invoice_claims").insert({
    supplier_id: supplierId,
    email_sent_to: email,
    transactions: JSON.parse(JSON.stringify(transactions)),
    total_amount: Math.abs(totalAmount),
    created_by: userData.user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/suppliers/bank-statement");
  return { success: true };
}

// --- Bank Statement persistence ---

export async function saveStatement(
  month: number,
  year: number,
  fileName: string,
  transactions: unknown[],
  totalCount: number,
  pendingCount: number
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("bank_statements")
    .upsert(
      {
        month,
        year,
        file_name: fileName,
        transactions: JSON.parse(JSON.stringify(transactions)),
        total_count: totalCount,
        pending_count: pendingCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month,year" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/suppliers/bank-statement");
}

export async function getStatements() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_statements")
    .select("id, month, year, file_name, total_count, pending_count, drive_folder_id, created_at, updated_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getStatement(month: number, year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_statements")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data;
}

export async function deleteStatement(month: number, year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("bank_statements")
    .delete()
    .eq("month", month)
    .eq("year", year);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/suppliers/bank-statement");
}

const MONTH_NAMES_ES = [
  "01 - Enero", "02 - Febrero", "03 - Marzo", "04 - Abril",
  "05 - Mayo", "06 - Junio", "07 - Julio", "08 - Agosto",
  "09 - Septiembre", "10 - Octubre", "11 - Noviembre", "12 - Diciembre",
];

export async function getOrCreateMonthFolder(month: number, year: number) {
  await requireRole("manager");
  const supabase = await createClient();

  // Check if we already have it cached
  const { data: existing } = await supabase
    .from("bank_statements")
    .select("drive_folder_id")
    .eq("month", month)
    .eq("year", year)
    .single();

  if (existing?.drive_folder_id) {
    return existing.drive_folder_id;
  }

  // Create year folder, then month subfolder
  const yearFolderId = await getOrCreateSubfolder(INVOICES_DRIVE_PARENT, String(year));
  const monthFolderName = MONTH_NAMES_ES[month - 1];
  const monthFolderId = await getOrCreateSubfolder(yearFolderId, monthFolderName);

  // Cache the folder ID
  await supabase
    .from("bank_statements")
    .update({ drive_folder_id: monthFolderId })
    .eq("month", month)
    .eq("year", year);

  return monthFolderId;
}

export async function getClaimHistory() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoice_claims")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data;
}
