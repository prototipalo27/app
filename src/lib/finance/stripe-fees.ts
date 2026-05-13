import Stripe from "stripe";

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

export interface StripePaymentBreakdown {
  gross: number;
  fee: number;
  net: number;
  currency: string;
  paidAt: Date | null;
}

// Obtiene comisión y neto de un PaymentIntent. Expandimos el latest_charge
// y su balance_transaction porque ahí es donde Stripe publica la fee real
// (varía por país, método de pago, BIN, etc. — no se puede precalcular).
export async function getStripePaymentBreakdown(
  paymentIntentId: string,
): Promise<StripePaymentBreakdown | null> {
  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") return null;

    const bt = charge.balance_transaction;
    if (!bt || typeof bt === "string") return null;

    const gross = bt.amount / 100;
    const fee = bt.fee / 100;
    const net = bt.net / 100;

    return {
      gross,
      fee,
      net,
      currency: bt.currency,
      paidAt: charge.created ? new Date(charge.created * 1000) : null,
    };
  } catch (err) {
    console.error("[stripe-fees] Failed to fetch breakdown for", paymentIntentId, err);
    return null;
  }
}
