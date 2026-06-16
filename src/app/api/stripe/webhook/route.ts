import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPushForEvent } from "@/lib/push-notifications/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function handleAddonPayment(session: Stripe.Checkout.Session) {
  const projectId = session.metadata?.project_id;
  const itemIds = (session.metadata?.item_ids ?? "").split(",").filter(Boolean);

  if (!projectId || itemIds.length === 0) {
    console.error("[Stripe Webhook] addon payment without project_id or item_ids");
    return;
  }

  const supabase = getSupabase();

  // Idempotency: ya procesado del todo (pagado Y facturado) → salir.
  const { data: existingItems } = await supabase
    .from("project_items")
    .select("addon_status, holded_invoice_id")
    .in("id", itemIds);

  if (
    existingItems &&
    existingItems.length > 0 &&
    existingItems.every((i) => i.addon_status === "paid" && i.holded_invoice_id)
  ) {
    return;
  }

  await supabase
    .from("project_items")
    .update({ addon_status: "paid" })
    .in("id", itemIds);

  const amountTotal = (session.amount_total || 0) / 100;

  // Factura propia de la ampliación (venta aparte): la ampliación NO se puede
  // añadir a la factura original (ya numerada y bloqueada al primer pago), así
  // que se emite su propia factura numerada. Solo si aún no la tiene.
  const needsInvoice = !existingItems || existingItems.some((i) => !i.holded_invoice_id);
  if (needsInvoice) {
    try {
      const { data: addonItems } = await supabase
        .from("project_items")
        .select("name, quantity, unit_price")
        .in("id", itemIds);
      const { data: project } = await supabase
        .from("projects")
        .select("holded_contact_id, name")
        .eq("id", projectId)
        .single();

      if (project?.holded_contact_id && addonItems && addonItems.length > 0) {
        const { createInvoice, approveInvoice, payInvoice, getDocument } = await import("@/lib/holded/api");
        const invoice = await createInvoice(project.holded_contact_id, {
          items: addonItems.map((it) => ({
            name: it.name,
            units: it.quantity,
            subtotal: Number(it.unit_price),
            tax: 21,
          })),
          notes: `Ampliación del proyecto ${project.name}`,
          approveDoc: true,
        });

        // Garantizar numeración (cuentas con "modo borrador").
        let docNumber: string | null = null;
        try {
          docNumber = (await getDocument("invoice", invoice.id)).docNumber || null;
        } catch {}
        if (!docNumber) await approveInvoice(invoice.id);

        // Registrar el pago Stripe contra la factura.
        await payInvoice(invoice.id, {
          amount: amountTotal,
          description: "Pago ampliación Stripe (tarjeta)",
        });

        await supabase
          .from("project_items")
          .update({ holded_invoice_id: invoice.id })
          .in("id", itemIds);
      }
    } catch (e) {
      console.error("[Stripe Webhook] addon invoice creation failed:", e);
    }
  }

  const customerEmail = session.customer_details?.email || session.customer_email || "Cliente";
  sendPushForEvent("payment_received", {
    title: "Pago de ampliación recibido",
    body: `${customerEmail} ha pagado ${amountTotal.toFixed(2)} € por items extra`,
    url: `/dashboard/projects/${projectId}`,
  });
}

async function handleStudioPayment(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.studio_payment_id;
  const projectId = session.metadata?.studio_project_id;
  if (!paymentId) {
    console.error("[Stripe Webhook] studio_payment without studio_payment_id");
    return;
  }

  const supabase = getSupabase();

  // Idempotency: skip if already paid
  const { data: existing } = await supabase
    .from("studio_payments")
    .select("payment_status")
    .eq("id", paymentId)
    .single();
  if (existing?.payment_status === "paid") return;

  const amountTotal = (session.amount_total || 0) / 100;
  await supabase
    .from("studio_payments")
    .update({
      payment_status: "paid",
      status: "cobrado",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", paymentId);

  const customerEmail =
    session.customer_details?.email || session.customer_email || "Cliente";
  sendPushForEvent("payment_received", {
    title: "Pago recibido (Studio)",
    body: `${customerEmail} ha pagado ${amountTotal.toFixed(2)} €`,
    url: projectId ? `/dashboard/studio/${projectId}` : "/dashboard/studio",
  });
}

async function handleCampDeposit(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.camp_registration_id;
  if (!registrationId) {
    console.error("[Stripe Webhook] camp_deposit without camp_registration_id");
    return;
  }

  const supabase = getSupabase();

  // Idempotency: si ya está pagada, salir.
  const { data: existing } = await supabase
    .from("camp_registrations")
    .select("status, payer_name, child_name")
    .eq("id", registrationId)
    .single();
  if (existing?.status === "paid") return;

  await supabase
    .from("camp_registrations")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", registrationId);

  const amountTotal = (session.amount_total || 0) / 100;
  const who = existing?.payer_name || session.customer_details?.email || "Un padre/madre";
  const child = existing?.child_name ? ` (${existing.child_name})` : "";
  sendPushForEvent("payment_received", {
    title: "Inscripción campamento confirmada",
    body: `${who}${child} ha pagado la señal de ${amountTotal.toFixed(2)} €`,
    url: "/dashboard",
  });
}

async function handlePaymentSuccess(session: Stripe.Checkout.Session) {
  // Branch on payment_type for addon vs original quote
  if (session.metadata?.payment_type === "addon_full") {
    await handleAddonPayment(session);
    return;
  }

  if (session.metadata?.payment_type === "studio_payment") {
    await handleStudioPayment(session);
    return;
  }

  if (session.metadata?.payment_type === "camp_deposit") {
    await handleCampDeposit(session);
    return;
  }

  const quoteRequestId = session.metadata?.quote_request_id;

  if (!quoteRequestId) {
    console.error("[Stripe Webhook] No quote_request_id in metadata");
    return;
  }

  // Normalize: `split_50` was the original tag for the first 50% (split flow
  // pre-rename). Treat any in-flight legacy session as a first half.
  const rawType = session.metadata?.payment_type;
  const tranche: "first_half" | "second_half" | "full" =
    rawType === "split_50_second"
      ? "second_half"
      : rawType === "split_50_first" || rawType === "split_50"
        ? "first_half"
        : "full";

  const supabase = getSupabase();

  // Idempotency: detect re-delivery of the same Stripe session per slot.
  const { data: existing } = await supabase
    .from("quote_requests")
    .select("payment_status, first_stripe_session_id, second_stripe_session_id, first_paid_amount")
    .eq("id", quoteRequestId)
    .single();

  if (tranche === "second_half" && existing?.second_stripe_session_id === session.id) return;
  if (tranche !== "second_half" && existing?.first_stripe_session_id === session.id) return;
  if (tranche === "full" && existing?.payment_status === "paid") return;

  const amountTotal = (session.amount_total || 0) / 100;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : null;

  // Comisión Stripe: la fee real solo se conoce tras el balance_transaction.
  let stripeFee: number | null = null;
  if (paymentIntentId) {
    const { getStripePaymentBreakdown } = await import("@/lib/finance/stripe-fees");
    const breakdown = await getStripePaymentBreakdown(paymentIntentId);
    if (breakdown) stripeFee = breakdown.fee;
  }

  const nowIso = new Date().toISOString();

  if (tranche === "second_half") {
    // Sumamos cumulativo en los campos legacy para que cashflow/displays vean
    // el total cobrado al final del flujo split.
    const firstAmount = Number((existing as { first_paid_amount?: number | null })?.first_paid_amount ?? 0) || 0;
    await supabase
      .from("quote_requests")
      .update({
        second_paid_amount: amountTotal,
        second_paid_at: nowIso,
        second_stripe_session_id: session.id,
        second_stripe_fee_amount: stripeFee,
        payment_status: "paid",
        paid_amount: firstAmount + amountTotal,
        paid_at: nowIso,
      })
      .eq("id", quoteRequestId);
  } else {
    // first_half o full — escribimos slot legacy + slot first_*. payment_status
    // payment_status solo pasa a 'paid' en full. En first_half el lead va a
    // "Pagados" igual (lo decide onPaymentConfirmed), pero payment_status del
    // QR queda null hasta que llegue también el segundo tramo.
    const update: Record<string, unknown> = {
      first_paid_amount: amountTotal,
      first_paid_at: nowIso,
      first_stripe_session_id: session.id,
      first_stripe_fee_amount: stripeFee,
      paid_at: nowIso,
      paid_amount: amountTotal,
      stripe_payment_intent_id: paymentIntentId,
      stripe_fee_amount: stripeFee,
    };
    if (tranche === "full") {
      update.payment_status = "paid";
    }
    await supabase.from("quote_requests").update(update).eq("id", quoteRequestId);
  }

  // Get customer info for notification
  const customerEmail = session.customer_details?.email || session.customer_email || "Cliente";
  const pushTitle =
    tranche === "second_half"
      ? "Segundo pago recibido"
      : tranche === "first_half"
        ? "Primer pago (50%) recibido"
        : "Pago recibido";
  sendPushForEvent("payment_received", {
    title: pushTitle,
    body: `${customerEmail} ha pagado ${amountTotal.toFixed(2)} €`,
    url: "/dashboard/crm",
  });

  // Trigger the auto-pipeline (invoice + project creation)
  try {
    const { onPaymentConfirmed } = await import("@/app/dashboard/crm/actions");
    await onPaymentConfirmed(quoteRequestId, {
      useServiceRole: true,
      tranche,
      paymentAmount: amountTotal,
      paymentIntentId,
    });
  } catch (err) {
    console.error("[Stripe Webhook] onPaymentConfirmed failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only process if payment is already collected (card, etc.)
    // For async payment methods (bank transfer, SEPA), payment_status will be
    // "unpaid" here — wait for checkout.session.async_payment_succeeded instead.
    if (session.payment_status === "paid") {
      await handlePaymentSuccess(session);
    }
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handlePaymentSuccess(session);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteRequestId = session.metadata?.quote_request_id;

    if (quoteRequestId) {
      const supabase = getSupabase();
      await supabase
        .from("quote_requests")
        .update({ payment_status: "failed" })
        .eq("id", quoteRequestId);

      const customerEmail = session.customer_details?.email || session.customer_email || "Cliente";
      sendPushForEvent("payment_received", {
        title: "Pago fallido",
        body: `El pago de ${customerEmail} por ${((session.amount_total || 0) / 100).toFixed(2)} € ha fallido`,
        url: "/dashboard/crm",
      });
    }
  }

  return NextResponse.json({ received: true });
}
