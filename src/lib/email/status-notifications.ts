import { sendEmail } from "@/lib/email";

/** States that trigger a client email notification */
const STATUS_EMAIL_MAP: Record<string, { subject: string; heading: string; message: string }> = {
  design: {
    subject: "Tu proyecto está en fase de diseño",
    heading: "Fase de diseño",
    message: "Hemos comenzado a trabajar en el diseño de tu proyecto. Te avisaremos cuando avancemos a la siguiente fase.",
  },
  printing: {
    subject: "Tu proyecto ha entrado en producción",
    heading: "En producción",
    message: "Tu proyecto ya está en nuestras impresoras 3D. Te informaremos cuando esté listo para enviar.",
  },
  shipping: {
    subject: "Tu pedido ha sido enviado",
    heading: "Pedido enviado",
    message: "Tu pedido ya está en camino. Puedes consultar el estado del envío en tu portal de seguimiento.",
  },
  delivered: {
    subject: "Tu pedido ha sido entregado",
    heading: "Pedido entregado",
    message: "Tu pedido ha sido entregado. Esperamos que todo sea de tu agrado. Si tienes alguna duda, no dudes en contactarnos.",
  },
};

/** Returns true if the given status should trigger a client email */
export function shouldNotifyStatus(status: string): boolean {
  return status in STATUS_EMAIL_MAP;
}

/** Send a status change notification email to the client */
export async function sendStatusNotification(
  clientEmail: string,
  projectName: string,
  newStatus: string,
  trackingToken: string,
) {
  const config = STATUS_EMAIL_MAP[newStatus];
  if (!config) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.prototipalo.com";
  const trackingLink = `${baseUrl}/track/${trackingToken}`;

  await sendEmail({
    to: clientEmail,
    subject: `${config.subject} — ${projectName}`,
    signature: false,
    text: `${config.heading}\n\n${config.message}\n\nConsulta el estado de tu proyecto:\n${trackingLink}\n\n— Prototipalo`,
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;">
  <div style="text-align:center;padding:24px 0;">
    <img src="https://prototipalo.com/logo-email.png" alt="Prototipalo" width="180" height="auto" style="display:inline-block;" />
  </div>
  <div style="background:#f4f4f5;border-radius:12px;padding:32px;text-align:center;">
    <h1 style="font-size:20px;color:#18181b;margin:0 0 12px;">${config.heading}</h1>
    <p style="font-size:14px;color:#52525b;line-height:1.6;margin:0 0 8px;">Proyecto: <strong>${projectName}</strong></p>
    <p style="font-size:14px;color:#52525b;line-height:1.6;margin:0 0 24px;">${config.message}</p>
    <a href="${trackingLink}" style="display:inline-block;background:#16a34a;color:white;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Ver estado del proyecto</a>
  </div>
  <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-top:24px;">
    Prototipalo — better in 3D
  </p>
</div>`,
  });
}
