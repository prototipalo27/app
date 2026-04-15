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

async function handlePaymentSuccess(session: Stripe.Checkout.Session) {
  const quoteRequestId = session.metadata?.quote_request_id;

  if (!quoteRequestId) {
    console.error("[Stripe Webhook] No quote_request_id in metadata");
    return;
  }

  const supabase = getSupabase();

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from("quote_requests")
    .select("payment_status")
    .eq("id", quoteRequestId)
    .single();

  if (existing?.payment_status === "paid") {
    return;
  }

  // Update payment status
  const amountTotal = (session.amount_total || 0) / 100;
  await supabase
    .from("quote_requests")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_amount: amountTotal,
      stripe_payment_intent_id: typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
    })
    .eq("id", quoteRequestId);

  // Get customer info for notification
  const customerEmail = session.customer_details?.email || session.customer_email || "Cliente";
  sendPushForEvent("payment_received", {
    title: "Pago recibido",
    body: `${customerEmail} ha pagado ${amountTotal.toFixed(2)} €`,
    url: "/dashboard/crm",
  });

  // Trigger the auto-pipeline (invoice + project creation)
  try {
    const { onPaymentConfirmed } = await import("@/app/dashboard/crm/actions");
    await onPaymentConfirmed(quoteRequestId, { useServiceRole: true });
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
