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
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;line-height:1.6;">
  <tr>
    <td style="padding-bottom:12px;">
      <strong style="font-size:15px;color:#1a1a1a;">Manuel de la Vi&ntilde;a</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:2px;">Viriato 27 &bull; 28010 Madrid</td>
  </tr>
  <tr>
    <td style="padding-bottom:2px;"><a href="tel:+34628673917" style="color:#333333;text-decoration:none;">+34 628 67 39 17</a></td>
  </tr>
  <tr>
    <td style="padding-bottom:14px;"><a href="https://prototipalo.com" style="color:#2563eb;text-decoration:underline;">Prototipalo.com</a></td>
  </tr>
  <tr>
    <td style="border-top:2px solid #dc2626;padding-top:14px;">
      <a href="https://prototipalo.com" style="text-decoration:none;">
        <img src="https://prototipalo.com/logo-email.png" alt="prototipalo — better in 3d" width="280" height="auto" style="display:block;" />
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
  });

  return result;
}
