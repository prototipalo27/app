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
  cc_emails?: { email: string; label: string }[];
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
    cc_emails: (data.cc_emails || []).filter((e) => e.email.trim()),
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

  // 3a. Find or create contact in Holded
  try {
    if (lead?.email) {
      const byEmail = await searchContacts(lead.email);
      if (byEmail.length > 0) holdedContactId = byEmail[0].id;
    }

    if (!holdedContactId) {
      const searchTerm = lead?.company || lead?.full_name || data.billing_name;
      const byName = await searchContacts(searchTerm);
      if (byName.length > 0) holdedContactId = byName[0].id;
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
      await updateContact(holdedContactId, {
        name: data.billing_name.trim(),
        code: data.tax_id.trim(),
        billAddress,
      });
    } else {
      const newContact = await createContact({
        name: data.billing_name.trim(),
        code: data.tax_id.trim(),
        email: lead?.email || undefined,
        phone: undefined,
        billAddress,
      });
      holdedContactId = newContact.id;
    }
  } catch (e) {
    console.error("[submitBillingData] Holded contact error:", e);
  }

  // 4. Create proforma in Holded
  let holdedProformaId: string | null = null;
  const originalItems = (qr.items || []) as unknown as QuoteItem[];
  const items = data.items && data.items.length > 0
    ? originalItems.map((orig, i) => ({
        ...orig,
        units: data.items![i] ? Math.max(1, data.items![i].units) : orig.units,
      }))
    : originalItems;

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
    try {
      const proforma = await createProforma(holdedContactId, {
        items: proformaItems,
        notes: proformaNotes,
      });
      holdedProformaId = proforma.id;
    } catch (e) {
      console.error("[submitBillingData] Holded proforma creation failed:", e);
    }
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

  // 5b. Move lead to "won" (cliente ha aceptado el presupuesto)
  const { data: currentLead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", qr.lead_id)
    .single();

  if (currentLead && currentLead.status !== "won" && currentLead.status !== "paid") {
    await supabase
      .from("leads")
      .update({ status: "won" })
      .eq("id", qr.lead_id);

    await supabase.from("lead_activities").insert({
      lead_id: qr.lead_id,
      activity_type: "status_change",
      content: `Estado cambiado de ${currentLead.status} a won (cliente envió datos de facturación)`,
      metadata: { old_status: currentLead.status, new_status: "won", auto: true },
    });
  }

  // 6. Create Stripe Checkout session for payment
  let stripeCheckoutUrl: string | null = null;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const isSplit = data.payment_option === "split";
    const discountFactor = isFullPayment ? 0.95 : 1;
    const subtotal = items.reduce((s, i) => s + i.price * i.units * discountFactor, 0);
    const taxTotal = items.reduce((s, i) => s + i.price * i.units * discountFactor * (i.tax / 100), 0);
    const total = subtotal + taxTotal;
    const chargeAmount = Math.round((isSplit ? total * 0.5 : total) * 100); // cents, IVA incluido

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
    const productName = isSplit
      ? "Primer pago (50%) — Proyecto Prototipalo"
      : "Pago completo — Proyecto Prototipalo";

    const checkoutParams: Record<string, unknown> = {
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: productName },
          unit_amount: chargeAmount,
        },
        quantity: 1,
      }],
      metadata: {
        lead_id: qr.lead_id,
        quote_request_id: qr.id,
        payment_type: isSplit ? "split_50" : "full",
      },
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
    };

    const existingCust = lead?.email
      ? await stripe.customers.list({ email: lead.email, limit: 1 })
      : { data: [] };
    const stripeCust = existingCust.data.length > 0
      ? existingCust.data[0]
      : await stripe.customers.create({ email: lead?.email || undefined, name: lead?.full_name || undefined });

    const session = await stripe.checkout.sessions.create({
      ...checkoutParams,
      customer: stripeCust.id,
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    stripeCheckoutUrl = session.url;
    await supabase.from("quote_requests").update({ stripe_checkout_session_id: session.id }).eq("id", qr.id);
  } catch (e) {
    console.error("[submitBillingData] Stripe checkout creation failed:", e);
  }

  await supabase.from("lead_activities").insert({
    lead_id: qr.lead_id,
    activity_type: "note",
    content: "Cliente ha enviado datos de facturación. Proforma generada y enviada con link de pago.",
    metadata: { auto: true, payment_option: data.payment_option },
  });

  // 7. Send proforma PDF by email (with payment link + bank details)
  if (holdedProformaId && lead?.email) {
    try {
      const pdfBuffer = await getDocumentPdf("proform", holdedProformaId);

      const isSplit = data.payment_option === "split";
      const discountFactor = isFullPayment ? 0.95 : 1;
      const total = items.reduce((s, i) => s + i.price * i.units * discountFactor, 0);
      const taxTotal = items.reduce((s, i) => s + i.price * i.units * discountFactor * (i.tax / 100), 0);
      const grandTotal = total + taxTotal;
      const payAmount = isSplit ? grandTotal * 0.5 : grandTotal;
      const formattedAmount = payAmount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const introLine = isSplit
        ? `Te adjuntamos la factura proforma correspondiente, para proceder al <strong>primer pago (50%)</strong> necesario para iniciar la produccion.`
        : `Te adjuntamos la factura proforma correspondiente, para proceder al <strong>pago total</strong>${isFullPayment ? " con un 5% de descuento por pago anticipado" : ""}.`;
      const introText = isSplit
        ? `Te adjuntamos la factura proforma correspondiente, para proceder al primer pago (50%) necesario para iniciar la produccion.`
        : `Te adjuntamos la factura proforma correspondiente, para proceder al pago total${isFullPayment ? " con un 5% de descuento por pago anticipado" : ""}.`;

      const conceptoLine = isSplit ? "Prototipalo – Inicio de proyecto (50%)" : "Prototipalo – Proyecto completo";

      const onlinePayText = stripeCheckoutUrl
        ? `\n\nTambien puedes completar el pago de forma rapida mediante tarjeta:\n${stripeCheckoutUrl}`
        : "";

      const ccList = (data.cc_emails || [])
        .map((e) => e.email.trim().toLowerCase())
        .filter((e) => e && e !== lead!.email);
      const ccString = ccList.length > 0 ? ccList.join(", ") : undefined;

      await sendEmail({
        to: lead.email,
        cc: ccString,
        subject: "Proforma — Prototipalo",
        signature: false,
        text: `Hola ${lead.full_name},\n\nMuchas gracias por confirmar el proyecto — estamos listos para empezar.\n\n${introText}\n\nImporte: ${formattedAmount} €\nConcepto: ${conceptoLine}\n\nPuedes realizar el pago mediante transferencia bancaria utilizando la referencia indicada:\n\nBanco: BBVA\nTitular: Prototipalo\nIBAN: ES24 0182 4010 3502 0181 5556\nSWIFT/BIC: BBVAESMM${onlinePayText}\n\nUna vez recibido el pago, comenzaremos la produccion de inmediato y te mantendremos informado del avance del proyecto.\n\nQuedamos atentos a cualquier duda.`,
        html: `
          <p>Hola ${lead.full_name},</p>
          <p>Muchas gracias por confirmar el proyecto — estamos listos para empezar.</p>
          <p>${introLine}</p>
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;font-size:14px;line-height:1.8;">
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Importe</td><td style="padding:0;font-weight:600;">${formattedAmount} €</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Concepto</td><td style="padding:0;font-weight:600;">${conceptoLine}</td></tr>
          </table>
          <p>Puedes realizar el pago mediante <strong>transferencia bancaria</strong> utilizando la referencia indicada:</p>
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;font-size:14px;line-height:1.8;">
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Banco</td><td style="padding:0;font-weight:600;">BBVA</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Titular</td><td style="padding:0;font-weight:600;">Prototipalo</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">IBAN</td><td style="padding:0;font-weight:600;">ES24 0182 4010 3502 0181 5556</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">SWIFT/BIC</td><td style="padding:0;font-weight:600;">BBVAESMM</td></tr>
          </table>
          ${stripeCheckoutUrl ? `<p>Tambien puedes completar el pago de forma rapida mediante tarjeta a traves del siguiente enlace:</p><p style="margin:16px 0;"><a href="${stripeCheckoutUrl}" style="display:inline-block;padding:14px 28px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Pagar con tarjeta</a></p>` : ""}
          <p>Una vez recibido el pago, comenzaremos la produccion de inmediato y te mantendremos informado del avance del proyecto.</p>
          <p>Quedamos atentos a cualquier duda.</p>
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

      console.log("[submitBillingData] Proforma email sent to", lead.email);
    } catch (e) {
      console.error("[submitBillingData] Failed to send proforma email:", e);
    }
  } else {
    console.error("[submitBillingData] Cannot send email — holdedProformaId:", holdedProformaId, "email:", lead?.email);
  }

  return { success: true };
}
