import nodemailer from "nodemailer";

const globalTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const DEFAULT_SIGNATURE_TEXT = `
--
Manuel de la Viña

Viriato 27 · 28010 Madrid
+34 628 67 39 17
Prototipalo.com`;

const DEFAULT_SIGNATURE_HTML = `
<br>
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#333333;line-height:1.6;">
  <tr>
    <td style="padding-bottom:10px;">
      <strong style="font-size:12px;color:#1a1a1a;">Manuel de la Vi&ntilde;a</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:2px;">Viriato 27 &bull; 28010 Madrid</td>
  </tr>
  <tr>
    <td style="padding-bottom:2px;"><a href="tel:+34628673917" style="color:#333333;text-decoration:none;">+34 628 67 39 17</a></td>
  </tr>
  <tr>
    <td style="padding-bottom:11px;"><a href="https://prototipalo.com" style="color:#2563eb;text-decoration:underline;">Prototipalo.com</a></td>
  </tr>
  <tr>
    <td style="padding-top:11px;">
      <a href="https://prototipalo.com" style="text-decoration:none;">
        <img src="https://rqqwvgdmbmgdbegpcvmz.supabase.co/storage/v1/object/public/assets/logo-email.png" alt="prototipalo — better in 3d" width="224" height="auto" style="display:block;" />
      </a>
    </td>
  </tr>
</table>`;

export interface SmtpConfig {
  user: string;
  pass: string;
  displayName: string;
  signatureHtml?: string | null;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  /** Set to false to omit the personal signature (e.g. system emails) */
  signature?: boolean;
  /** Per-user SMTP credentials. Falls back to global SMTP_USER/SMTP_PASS. */
  smtpConfig?: SmtpConfig;
  attachments?: EmailAttachment[];
}

/** Allowed send window (Europe/Madrid). Outside this → queued to next 8:00. */
const EMAIL_MIN_HOUR = 8;
const EMAIL_MAX_HOUR = 20; // 8pm

function getMadridHour(): number {
  const now = new Date();
  const madrid = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  return madrid.getHours();
}

/**
 * Serialize email options to a JSON-safe payload (attachments → base64).
 */
function serializeEmailPayload(options: SendEmailOptions): Record<string, unknown> {
  const { attachments, smtpConfig, ...rest } = options;
  return {
    ...rest,
    smtpConfig: smtpConfig ? { user: smtpConfig.user, pass: smtpConfig.pass, displayName: smtpConfig.displayName, signatureHtml: smtpConfig.signatureHtml } : undefined,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      contentBase64: a.content.toString("base64"),
      contentType: a.contentType,
    })),
  };
}

/**
 * Deserialize a stored payload back into SendEmailOptions.
 */
export function deserializeEmailPayload(payload: Record<string, unknown>): SendEmailOptions {
  const { attachments, smtpConfig, ...rest } = payload as Record<string, any>;
  return {
    ...rest,
    smtpConfig: smtpConfig || undefined,
    attachments: attachments?.map((a: any) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      contentType: a.contentType,
    })),
  } as SendEmailOptions;
}

/**
 * Send email now, or schedule it for 8:00 AM Madrid time if it's night hours.
 * Returns { scheduled: true } if queued, or the nodemailer result if sent.
 */
export async function sendEmailOrSchedule(
  options: SendEmailOptions,
  meta?: { createdBy?: string; leadId?: string; forceNow?: boolean }
): Promise<{ scheduled: boolean; messageId?: string }> {
  const hour = getMadridHour();

  if (meta?.forceNow || (hour >= EMAIL_MIN_HOUR && hour < EMAIL_MAX_HOUR)) {
    // During allowed hours (8:00–19:59) → send immediately
    const result = await sendEmail(options);
    return { scheduled: false, messageId: result.messageId };
  }

  // Outside window → schedule for next 8:00 AM Madrid
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();

  // Calculate next 8:00 AM Madrid time
  const now = new Date();
  const madridStr = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
  const madridNow = new Date(madridStr);
  const sendAt = new Date(madridNow);
  sendAt.setHours(EMAIL_MIN_HOUR, 0, 0, 0);
  // If somehow it's already past 8am in Madrid (shouldn't happen given the check), push to tomorrow
  if (sendAt <= madridNow) {
    sendAt.setDate(sendAt.getDate() + 1);
  }

  // Convert back to UTC for storage: calculate the offset
  const offsetMs = now.getTime() - madridNow.getTime();
  const sendAtUtc = new Date(sendAt.getTime() + offsetMs);

  const payload = serializeEmailPayload(options);

  await (supabase as any).from("scheduled_emails").insert({
    send_at: sendAtUtc.toISOString(),
    payload,
    created_by: meta?.createdBy || null,
  });

  return { scheduled: true };
}

export async function sendEmail(options: SendEmailOptions) {
  const config = options.smtpConfig;

  // Determine which transporter to use
  let transporter: nodemailer.Transporter;
  let fromEmail: string;
  let fromName: string;

  if (config) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.user, pass: config.pass },
    });
    fromEmail = config.user;
    fromName = config.displayName;
  } else {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP_USER y SMTP_PASS deben estar configurados en las variables de entorno");
    }
    transporter = globalTransporter;
    fromEmail = process.env.SMTP_USER;
    fromName = "Prototipalo";
  }

  const includeSignature = options.signature !== false;

  const headers: Record<string, string> = {};
  if (options.inReplyTo) {
    headers["In-Reply-To"] = options.inReplyTo;
  }
  if (options.references?.length) {
    headers["References"] = options.references.join(" ");
  }

  // Pick signature based on config
  const signatureHtml = config?.signatureHtml || DEFAULT_SIGNATURE_HTML;
  const signatureText = config ? `\n--\n${config.displayName}\nPrototipalo.com` : DEFAULT_SIGNATURE_TEXT;

  const text = includeSignature ? options.text + signatureText : options.text;
  const html = options.html
    ? (includeSignature ? options.html + signatureHtml : options.html)
    : undefined;

  const result = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    text,
    html,
    replyTo: options.replyTo || fromEmail,
    headers,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  return result;
}
