"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { searchContacts, updateContact, createProforma } from "@/lib/holded/api";

interface BillingData {
  billing_name: string;
  tax_id: string;
  billing_address: string;
  billing_postal_code: string;
  billing_city: string;
  billing_province: string;
  billing_country: string;
}

export async function submitBillingData(
  token: string,
  data: BillingData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Validate token exists and is pending
  const { data: qr, error: qrError } = await supabase
    .from("quote_requests")
    .select("*, leads(email, full_name, company)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (qrError || !qr) {
    return { success: false, error: "Enlace no válido o ya utilizado" };
  }

  // 2. Save billing data
  const { error: updateError } = await supabase
    .from("quote_requests")
    .update({
      billing_name: data.billing_name.trim(),
      tax_id: data.tax_id.trim(),
      billing_address: data.billing_address.trim(),
      billing_city: data.billing_city.trim(),
      billing_postal_code: data.billing_postal_code.trim(),
      billing_province: data.billing_province.trim(),
      billing_country: data.billing_country.trim(),
    })
    .eq("id", qr.id);

  if (updateError) {
    return { success: false, error: "Error al guardar datos" };
  }

  // 3. Find or match contact in Holded
  const lead = qr.leads as { email: string | null; full_name: string; company: string | null } | null;
  let holdedContactId: string | null = null;

  try {
    // Search by email first
    if (lead?.email) {
      const byEmail = await searchContacts(lead.email);
      if (byEmail.length > 0) {
        holdedContactId = byEmail[0].id;
      }
    }

    // Fallback: search by company or name
    if (!holdedContactId) {
      const searchTerm = lead?.company || lead?.full_name || data.billing_name;
      const byName = await searchContacts(searchTerm);
      if (byName.length > 0) {
        holdedContactId = byName[0].id;
      }
    }

    // 4. Update contact if found
    if (holdedContactId) {
      await updateContact(holdedContactId, {
        name: data.billing_name.trim(),
        code: data.tax_id.trim(),
        billAddress: {
          address: data.billing_address.trim(),
          city: data.billing_city.trim(),
          postalCode: data.billing_postal_code.trim(),
          province: data.billing_province.trim(),
          country: data.billing_country.trim(),
          countryCode: data.billing_country.trim().toLowerCase() === "españa" ? "ES" : undefined,
        },
      });
    }

    // 5. Create proforma draft if we have a contact
    let holdedProformaId: string | null = null;
    if (holdedContactId) {
      const proforma = await createProforma(holdedContactId);
      holdedProformaId = proforma.id;
    }

    // 6. Mark as submitted
    await supabase
      .from("quote_requests")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        holded_contact_id: holdedContactId,
        holded_proforma_id: holdedProformaId,
      })
      .eq("id", qr.id);

    return { success: true };
  } catch (e) {
    // Even if Holded fails, save the billing data and mark submitted
    await supabase
      .from("quote_requests")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", qr.id);

    return { success: true };
  }
}
