import type Stripe from "stripe";

/**
 * Crea un Stripe Payment Link de un solo uso para enviar por email.
 *
 * A diferencia de las Checkout Sessions (que caducan a las 24h), los Payment
 * Links no expiran, por lo que el cliente puede pagar días después de recibir
 * el correo. Se restringen a un único pago completado para que funcionen como
 * una factura de pago único.
 *
 * El `metadata` se copia automáticamente a la Checkout Session que Stripe crea
 * cuando el cliente paga, así que el webhook (`checkout.session.completed`) lo
 * recibe en `session.metadata` igual que antes — no hace falta cambiar nada en
 * el webhook.
 */
export async function createOneTimePaymentLink(params: {
  /** Nombre del producto que verá el cliente en Stripe. */
  label: string;
  /** Importe a cobrar, en céntimos, IVA incluido. */
  amountCents: number;
  /** Metadata que el webhook usa para reconciliar el pago. */
  metadata: Record<string, string>;
  /**
   * Ruta de redirección tras el pago (relativa a NEXT_PUBLIC_BASE_URL).
   * Por defecto la página de éxito con el session_id para verificar el estado.
   */
  successPath?: string;
}): Promise<{ id: string; url: string }> {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const redirectUrl = `${baseUrl}${
    params.successPath ?? "/payment/success?session_id={CHECKOUT_SESSION_ID}"
  }`;

  const link = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: params.label },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: params.metadata,
    payment_intent_data: { metadata: params.metadata },
    restrictions: { completed_sessions: { limit: 1 } },
    after_completion: {
      type: "redirect",
      redirect: { url: redirectUrl },
    },
  } satisfies Stripe.PaymentLinkCreateParams);

  return { id: link.id, url: link.url };
}
