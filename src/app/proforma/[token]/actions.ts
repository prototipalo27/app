"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getDocument, updateContact } from "@/lib/holded/api";
import { sendPushForEvent } from "@/lib/push-notifications/server";

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

export type PaymentCondition = "50-50" | "100-5" | "100-0";

// Below this subtotal (base imponible, sin IVA) the client cannot choose — single payment only.
export const DISCOUNT_THRESHOLD_EUR = 400;

export async function acceptProforma(
  token: string,
  billing: BillingData,
  shipping: ShippingData,
  paymentCondition: PaymentCondition,
): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, holded_contact_id, holded_proforma_id, tracking_token")
    .eq("tracking_token", token)
    .single();

  if (!project) {
    return { success: false, error: "Enlace no válido" };
  }

  if (!project.holded_proforma_id) {
    return { success: false, error: "Presupuesto no disponible" };
  }

  // Fetch proforma totals from Holded (authoritative amounts)
  let proformaSubtotal = 0;
  let proformaTotal = 0;
  let proformaDocNumber = "";
  try {
    const doc = await getDocument("proform", project.holded_proforma_id);
    proformaSubtotal = doc.subtotal || 0;
    proformaTotal = doc.total || 0;
    proformaDocNumber = doc.docNumber || "";
  } catch {
    return { success: false, error: "No pudimos cargar el presupuesto" };
  }

  // Enforce threshold: under DISCOUNT_THRESHOLD_EUR (base imponible) force 100-0
  const effectiveCondition: PaymentCondition =
    proformaSubtotal < DISCOUNT_THRESHOLD_EUR ? "100-0" : paymentCondition;

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
      await supabase.from("shipping_info").upsert(shippingRow, {
        onConflict: "project_id",
      });
    }

    // 3. Update quote_request if linked — includes payment_condition
    const quoteRequests = project.holded_contact_id
      ? (await supabase
          .from("quote_requests")
          .select("id, lead:leads(email, full_name)")
          .eq("holded_contact_id", project.holded_contact_id)
          .limit(1)).data
      : null;

    const quoteRequest = quoteRequests?.[0] ?? null;
    const leadInfo = (quoteRequest?.lead ?? null) as { email: string | null; full_name: string | null } | null;

    if (quoteRequest) {
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
          payment_condition: effectiveCondition,
        })
        .eq("id", quoteRequest.id);
    }

    // 4. Create Stripe checkout for the right amount
    const chargeAmount = computeChargeAmount(proformaTotal, effectiveCondition);
    let stripeUrl: string | null = null;
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";

      const customerEmail = leadInfo?.email ?? undefined;
      const customerName = leadInfo?.full_name ?? undefined;

      let stripeCustomerId: string | undefined;
      if (customerEmail) {
        const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
        const cust = existing.data.length > 0
          ? existing.data[0]
          : await stripe.customers.create({ email: customerEmail, name: customerName });
        stripeCustomerId = cust.id;
      }

      const productName =
        effectiveCondition === "50-50"
          ? "Primer pago (50%) — Proyecto Prototipalo"
          : effectiveCondition === "100-5"
            ? "Pago total (100% con 5% dto.) — Proyecto Prototipalo"
            : "Pago total — Proyecto Prototipalo";

      const paymentType =
        effectiveCondition === "50-50"
          ? "split_50"
          : effectiveCondition === "100-5"
            ? "full_discounted"
            : "full";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: productName },
              unit_amount: Math.round(chargeAmount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          project_id: project.id,
          quote_request_id: quoteRequest?.id ?? "",
          lead_id: quoteRequest?.id ?? "",
          payment_type: paymentType,
          payment_condition: effectiveCondition,
          proforma_doc_number: proformaDocNumber,
        },
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/proforma/${token}`,
        customer: stripeCustomerId,
      });

      stripeUrl = session.url;

      if (quoteRequest) {
        await supabase
          .from("quote_requests")
          .update({ stripe_checkout_session_id: session.id })
          .eq("id", quoteRequest.id);
      }
    } catch (err) {
      console.error("[acceptProforma] Stripe checkout failed:", err);
      return {
        success: false,
        error: "No pudimos generar el enlace de pago. Vuelve a intentarlo en unos minutos.",
      };
    }

    // 5. Push notification to team
    await sendPushForEvent("proforma_accepted", {
      title: "Proforma aceptada",
      body: `${billing.billing_name} acepta "${project.name}" (${effectiveCondition})`,
      url: `/dashboard/projects/${project.id}`,
    });

    return { success: true, redirectUrl: stripeUrl ?? undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al procesar la aceptación",
    };
  }
}

function computeChargeAmount(proformaTotal: number, condition: PaymentCondition): number {
  if (condition === "100-5") return proformaTotal * 0.95;
  if (condition === "50-50") return proformaTotal * 0.5;
  return proformaTotal;
}
