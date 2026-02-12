"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";

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
