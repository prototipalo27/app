"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { updateContact } from "@/lib/holded/api";
import { sendPushToAll } from "@/lib/push-notifications/server";

interface BillingData {
  billing_name: string;
  tax_id: string;
  billing_address: string;
  billing_postal_code: string;
  billing_city: string;
  billing_province: string;
  billing_country: string;
}

interface ShippingData {
  recipient_name: string;
  recipient_phone: string;
  address: string;
  city: string;
  postal_code: string;
  province: string;
  country: string;
}

export async function acceptProforma(
  token: string,
  billing: BillingData,
  shipping: ShippingData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Find project by tracking_token
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, holded_contact_id, tracking_token")
    .eq("tracking_token", token)
    .single();

  if (!project) {
    return { success: false, error: "Enlace no válido" };
  }

  try {
    // 1. Update Holded contact with billing data
    if (project.holded_contact_id) {
      try {
        await updateContact(project.holded_contact_id, {
          name: billing.billing_name.trim(),
          code: billing.tax_id.trim(),
          billAddress: {
            address: billing.billing_address.trim(),
            city: billing.billing_city.trim(),
            postalCode: billing.billing_postal_code.trim(),
            province: billing.billing_province.trim(),
            country: billing.billing_country.trim(),
            countryCode: billing.billing_country.trim().toLowerCase() === "españa" ? "ES" : undefined,
          },
        });
      } catch {
        // Log but don't fail — Holded update is best-effort
        console.error("Failed to update Holded contact");
      }
    }

    // 2. Create/update shipping_info
    const { data: existingShipping } = await supabase
      .from("shipping_info")
      .select("id")
      .eq("project_id", project.id)
      .maybeSingle();

    const shippingRow = {
      project_id: project.id,
      recipient_name: shipping.recipient_name.trim(),
      recipient_phone: shipping.recipient_phone.trim(),
      address_line: shipping.address.trim(),
      city: shipping.city.trim(),
      postal_code: shipping.postal_code.trim(),
      country: shipping.country.trim().toLowerCase() === "españa" ? "ES" : shipping.country.trim(),
    };

    if (existingShipping) {
      await supabase
        .from("shipping_info")
        .update(shippingRow)
        .eq("id", existingShipping.id);
    } else {
      await supabase.from("shipping_info").insert(shippingRow);
    }

    // 3. Update quote_request if linked (find by holded_proforma_id or lead)
    const { data: quoteRequests } = await supabase
      .from("quote_requests")
      .select("id")
      .eq("holded_proforma_id", project.holded_contact_id)
      .limit(1);

    if (quoteRequests && quoteRequests.length > 0) {
      await supabase
        .from("quote_requests")
        .update({
          billing_name: billing.billing_name.trim(),
          tax_id: billing.tax_id.trim(),
          billing_address: billing.billing_address.trim(),
          billing_city: billing.billing_city.trim(),
          billing_postal_code: billing.billing_postal_code.trim(),
          billing_province: billing.billing_province.trim(),
          billing_country: billing.billing_country.trim(),
          shipping_address: shipping.address.trim(),
          shipping_city: shipping.city.trim(),
          shipping_postal_code: shipping.postal_code.trim(),
          shipping_province: shipping.province.trim(),
          shipping_country: shipping.country.trim(),
          shipping_recipient_name: shipping.recipient_name.trim(),
          shipping_recipient_phone: shipping.recipient_phone.trim(),
          proforma_accepted_at: new Date().toISOString(),
        })
        .eq("id", quoteRequests[0].id);
    }

    // 4. Send push notification to team
    await sendPushToAll({
      title: "Proforma aceptada",
      body: `El cliente ha aceptado el presupuesto de "${project.name}"`,
      url: `/dashboard/projects/${project.id}`,
    });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al procesar la aceptación",
    };
  }
}
