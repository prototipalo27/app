"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { searchContacts, createContact, updateContact, createProforma } from "@/lib/holded/api";

interface BillingData {
  billing_name: string;
  tax_id: string;
  billing_address: string;
  billing_postal_code: string;
  billing_city: string;
  billing_province: string;
  billing_country: string;
  needs_shipping: boolean;
  shipping_recipient_name: string | null;
  shipping_recipient_phone: string | null;
  shipping_address: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_country: string | null;
}

interface QuoteItem {
  concept: string;
  price: number;
  units: number;
  tax: number;
}

export async function submitBillingData(
  token: string,
  data: BillingData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Validate token exists and is pending/quote_sent
  const { data: qr, error: qrError } = await supabase
    .from("quote_requests")
    .select("*, leads(email, full_name, company)")
    .eq("token", token)
    .in("status", ["pending", "quote_sent"])
    .single();

  if (qrError || !qr) {
    return { success: false, error: "Enlace no válido o ya utilizado" };
  }

  // 2. Save billing + shipping data
  const updatePayload: Record<string, unknown> = {
    billing_name: data.billing_name.trim(),
    tax_id: data.tax_id.trim(),
    billing_address: data.billing_address.trim(),
    billing_city: data.billing_city.trim(),
    billing_postal_code: data.billing_postal_code.trim(),
    billing_province: data.billing_province.trim(),
    billing_country: data.billing_country.trim(),
  };

  if (data.needs_shipping) {
    updatePayload.shipping_recipient_name = data.shipping_recipient_name?.trim() || null;
    updatePayload.shipping_recipient_phone = data.shipping_recipient_phone?.trim() || null;
    updatePayload.shipping_address = data.shipping_address?.trim() || null;
    updatePayload.shipping_city = data.shipping_city?.trim() || null;
    updatePayload.shipping_postal_code = data.shipping_postal_code?.trim() || null;
    updatePayload.shipping_province = data.shipping_province?.trim() || null;
    updatePayload.shipping_country = data.shipping_country?.trim() || null;
  }

  const { error: updateError } = await supabase
    .from("quote_requests")
    .update(updatePayload)
    .eq("id", qr.id);

  if (updateError) {
    return { success: false, error: "Error al guardar datos" };
  }

  // 3. Find or create contact in Holded
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

    const billAddress = {
      address: data.billing_address.trim(),
      city: data.billing_city.trim(),
      postalCode: data.billing_postal_code.trim(),
      province: data.billing_province.trim(),
      country: data.billing_country.trim(),
      countryCode: data.billing_country.trim().toLowerCase() === "españa" ? "ES" : undefined,
    };

    if (holdedContactId) {
      // Update existing contact
      await updateContact(holdedContactId, {
        name: data.billing_name.trim(),
        code: data.tax_id.trim(),
        billAddress,
      });
    } else {
      // Create new contact
      const newContact = await createContact({
        name: data.billing_name.trim(),
        code: data.tax_id.trim(),
        email: lead?.email || undefined,
        phone: undefined,
        billAddress,
      });
      holdedContactId = newContact.id;
    }

    // 4. Create proforma in Holded with the saved quote items
    let holdedProformaId: string | null = null;
    const items = (qr.items || []) as unknown as QuoteItem[];

    if (holdedContactId && items.length > 0) {
      const proforma = await createProforma(holdedContactId, {
        items: items.map((item) => ({
          name: item.concept,
          units: item.units,
          subtotal: item.price,
          tax: item.tax,
        })),
        notes: qr.notes || undefined,
      });
      holdedProformaId = proforma.id;
    }

    // 5. Mark as submitted
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
  } catch {
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
