"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";

export async function createSupplier(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  if (!name?.trim()) {
    redirect("/dashboard/suppliers/new");
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: name.trim(),
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      nif_cif: (formData.get("nif_cif") as string)?.trim() || null,
      address: (formData.get("address") as string)?.trim() || null,
      city: (formData.get("city") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || "ES",
      holded_contact_id:
        (formData.get("holded_contact_id") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/suppliers");
  redirect(`/dashboard/suppliers/${data.id}`);
}

export async function updateSupplier(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: (formData.get("name") as string)?.trim(),
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      nif_cif: (formData.get("nif_cif") as string)?.trim() || null,
      address: (formData.get("address") as string)?.trim() || null,
      city: (formData.get("city") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || "ES",
      notes: (formData.get("notes") as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/suppliers/${id}`);
  revalidatePath("/dashboard/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;

  const { error } = await supabase.from("suppliers").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/suppliers");
  redirect("/dashboard/suppliers");
}

export async function addPayment(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const supplierId = formData.get("supplier_id") as string;
  const amount = formData.get("amount") as string;

  const hasInvoice = formData.get("has_invoice") === "on";
  const invoiceNumber = (formData.get("invoice_number") as string)?.trim() || null;
  const invoiceDateStr = formData.get("invoice_date") as string;

  const { error } = await supabase.from("supplier_payments").insert({
    supplier_id: supplierId,
    payment_date: formData.get("payment_date") as string,
    amount: parseFloat(amount),
    description: (formData.get("description") as string)?.trim() || null,
    has_invoice: hasInvoice,
    invoice_number: hasInvoice ? invoiceNumber : null,
    invoice_date: hasInvoice && invoiceDateStr ? invoiceDateStr : null,
    notes: (formData.get("notes") as string)?.trim() || null,
    created_by: userData.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
}

export async function updatePayment(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;
  const supplierId = formData.get("supplier_id") as string;
  const amount = formData.get("amount") as string;
  const hasInvoice = formData.get("has_invoice") === "on";
  const invoiceNumber = (formData.get("invoice_number") as string)?.trim() || null;
  const invoiceDateStr = formData.get("invoice_date") as string;

  const { error } = await supabase
    .from("supplier_payments")
    .update({
      payment_date: formData.get("payment_date") as string,
      amount: parseFloat(amount),
      description: (formData.get("description") as string)?.trim() || null,
      has_invoice: hasInvoice,
      invoice_number: hasInvoice ? invoiceNumber : null,
      invoice_date: hasInvoice && invoiceDateStr ? invoiceDateStr : null,
      notes: (formData.get("notes") as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
}

export async function markInvoiceReceived(
  paymentId: string,
  invoiceNumber: string
) {
  await requireRole("manager");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supplier_payments")
    .update({
      has_invoice: true,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("supplier_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/suppliers/${data.supplier_id}`);
}

export async function deletePayment(paymentId: string, supplierId: string) {
  await requireRole("manager");

  const supabase = await createClient();

  const { error } = await supabase
    .from("supplier_payments")
    .delete()
    .eq("id", paymentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
}

export async function addSupplierProduct(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const supplierId = formData.get("supplier_id") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    return { success: false, error: "El nombre del producto es obligatorio" };
  }

  const { error } = await supabase.from("supplier_products").insert({
    supplier_id: supplierId,
    name,
    category: (formData.get("category") as string)?.trim() || null,
    url: (formData.get("url") as string)?.trim() || null,
    price: formData.get("price")
      ? parseFloat(formData.get("price") as string)
      : null,
    notes: (formData.get("notes") as string)?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
  revalidatePath("/dashboard/suppliers/products");
  return { success: true };
}

export async function deleteSupplierProduct(
  productId: string,
  supplierId: string
) {
  await requireRole("manager");

  const supabase = await createClient();

  const { error } = await supabase
    .from("supplier_products")
    .delete()
    .eq("id", productId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
  revalidatePath("/dashboard/suppliers/products");
  return { success: true };
}
