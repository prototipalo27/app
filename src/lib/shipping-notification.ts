import { sendEmail } from "@/lib/email";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";

interface ShippingNotificationParams {
  clientEmail: string;
  clientName: string | null;
  projectName: string;
  carrier: string;
  trackingNumber: string;
  trackingToken: string;
}

export async function sendShippingNotification(
  params: ShippingNotificationParams,
): Promise<void> {
  const {
    clientEmail,
    clientName,
    projectName,
    carrier,
    trackingNumber,
    trackingToken,
  } = params;

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const greeting = clientName ? `Hola ${clientName}` : "Hola";

  const subject = `Tu pedido "${projectName}" ha sido enviado`;

  const text = `${greeting},

Tu pedido "${projectName}" ha sido enviado con ${carrier}.

Número de seguimiento: ${trackingNumber}

Puedes seguir el estado de tu envío aquí: ${trackingUrl}

¡Gracias por confiar en Prototipalo!`;

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-size: 15px; line-height: 1.6;">${greeting},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Tu pedido <strong>&ldquo;${projectName}&rdquo;</strong> ha sido enviado con <strong>${carrier}</strong>.
  </p>
  <p style="font-size: 15px; line-height: 1.6;">
    Número de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${trackingUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 8px;">
      Seguir mi pedido
    </a>
  </div>
  <p style="font-size: 14px; color: #666666; line-height: 1.6;">¡Gracias por confiar en Prototipalo!</p>
</div>`;

  await sendEmail({
    to: clientEmail,
    subject,
    text,
    html,
    signature: false,
  });
}
