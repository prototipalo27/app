"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { searchContacts, createContact, updateContact, createProforma, getDocumentPdf } from "@/lib/holded/api";
import { sendEmail } from "@/lib/email";

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
  items?: QuoteItem[];
  payment_option: "full" | "split";
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

  // Save updated items (client may have changed units)
  if (data.items && data.items.length > 0) {
    // Keep original prices/concepts, only allow units changes
    const originalItems = (qr.items || []) as unknown as QuoteItem[];
    const safeItems = originalItems.map((orig, i) => ({
      ...orig,
      units: data.items![i] ? Math.max(1, data.items![i].units) : orig.units,
    }));
    updatePayload.items = safeItems as unknown as Record<string, unknown>;
  }

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

    // 4. Create proforma in Holded with the (potentially updated) items
    let holdedProformaId: string | null = null;
    const originalItems = (qr.items || []) as unknown as QuoteItem[];
    const items = data.items && data.items.length > 0
      ? originalItems.map((orig, i) => ({
          ...orig,
          units: data.items![i] ? Math.max(1, data.items![i].units) : orig.units,
        }))
      : originalItems;

    // Apply 5% discount if paying 100% upfront
    const isFullPayment = data.payment_option === "full";
    const proformaItems = items.map((item) => ({
      name: item.concept,
      units: item.units,
      subtotal: isFullPayment
        ? Math.round(item.price * 0.95 * 100) / 100
        : item.price,
      tax: item.tax,
    }));

    const proformaNotes = [
      qr.notes || "",
      isFullPayment
        ? "Pago único — 5% de descuento aplicado."
        : "Pago 50% a la aceptación, 50% a la entrega.",
    ].filter(Boolean).join("\n");

    if (holdedContactId && proformaItems.length > 0) {
      const proforma = await createProforma(holdedContactId, {
        items: proformaItems,
        notes: proformaNotes,
      });
      holdedProformaId = proforma.id;
    }

    // 5. Mark as submitted + save payment option
    await supabase
      .from("quote_requests")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        holded_contact_id: holdedContactId,
        holded_proforma_id: holdedProformaId,
        payment_option: data.payment_option,
      })
      .eq("id", qr.id);

    // 6. Update lead status to "won" (ganado)
    await supabase
      .from("leads")
      .update({ status: "won" })
      .eq("id", qr.lead_id);

    await supabase.from("lead_activities").insert({
      lead_id: qr.lead_id,
      activity_type: "status_change",
      content: "Estado cambiado a won — cliente ha enviado datos de facturación",
      metadata: { new_status: "won", auto: true, payment_option: data.payment_option },
    });

    // 7. Send proforma PDF by email
    if (holdedProformaId && lead?.email) {
      try {
        const pdfBuffer = await getDocumentPdf("proform", holdedProformaId);
        const bookingUrl = process.env.BOOKING_URL || "https://prototipalo.com";

        await sendEmail({
          to: lead.email,
          subject: "Proforma — Prototipalo",
          signature: false,
          text: `Hola ${lead.full_name},\n\nGracias por confirmar tu proyecto. Adjuntamos la proforma para proceder al pago y arrancar con la producción lo antes posible.\n\n${isFullPayment ? "Se ha aplicado un 5% de descuento por pago único." : "El pago se divide en dos plazos: 50% ahora y 50% a la entrega."}\n\nSi quieres, puedes reservar una reunión para poner todo en marcha:\n${bookingUrl}\n\nGracias,\nEl equipo de Prototipalo`,
          html: `
            <p>Hola ${lead.full_name},</p>
            <p>Gracias por confirmar tu proyecto. Adjuntamos la proforma para proceder al pago y arrancar con la producción lo antes posible.</p>
            <p style="background:#f4f4f5;border-radius:8px;padding:12px 16px;font-size:13px;color:#52525b;">
              ${isFullPayment
                ? "💰 Se ha aplicado un <strong>5% de descuento</strong> por pago único."
                : "💰 El pago se divide en dos plazos: <strong>50% ahora</strong> y <strong>50% a la entrega</strong>."}
            </p>
            <p>¿Quieres que hablemos sobre los detalles del proyecto? Reserva una reunión y lo ponemos todo en marcha:</p>
            <p>
              <a href="${bookingUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">
                Reservar reunión
              </a>
            </p>
            <p style="font-size:12px;color:#a1a1aa;margin-top:24px;">La proforma va adjunta a este email en formato PDF.</p>
            <br>
            <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#333333;line-height:1.6;">
              <tr><td style="padding-bottom:10px;"><strong style="font-size:12px;color:#1a1a1a;">El equipo de Prototipalo</strong></td></tr>
              <tr><td style="padding-bottom:2px;">Viriato 27 &bull; 28010 Madrid</td></tr>
              <tr><td style="padding-bottom:11px;"><a href="https://prototipalo.com" style="color:#2563eb;text-decoration:underline;">Prototipalo.com</a></td></tr>
              <tr><td style="padding-top:11px;"><a href="https://prototipalo.com" style="text-decoration:none;"><img src="https://rqqwvgdmbmgdbegpcvmz.supabase.co/storage/v1/object/public/assets/logo-email.png" alt="prototipalo — better in 3d" width="224" height="auto" style="display:block;" /></a></td></tr>
            </table>
          `,
          attachments: [{
            filename: "Proforma-Prototipalo.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          }],
        });
      } catch {
        // PDF/email failure should not block the submission
      }
    }

    return { success: true };
  } catch {
    // Even if Holded fails, save the billing data and mark submitted
    await supabase
      .from("quote_requests")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        payment_option: data.payment_option,
      })
      .eq("id", qr.id);

    // Still update lead to won
    await supabase
      .from("leads")
      .update({ status: "won" })
      .eq("id", qr.lead_id);

    return { success: true };
  }
}
