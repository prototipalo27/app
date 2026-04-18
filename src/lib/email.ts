import nodemailer from "nodemailer";
import type { EmailSender, OAuthSender } from "./email-sender";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

/** @deprecated Use EmailSender from email-sender.ts instead */
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
  cc?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  /** Set to false to omit the personal signature (e.g. system emails) */
  signature?: boolean;
  /** New: resolved EmailSender (OAuth or SMTP). Takes priority over smtpConfig. */
  emailSender?: EmailSender;
  /** @deprecated Legacy per-user SMTP credentials. Use emailSender instead. */
  smtpConfig?: SmtpConfig;
  attachments?: EmailAttachment[];
  /** Optional entity tracking for sent_emails table */
  entityType?: string;
  entityId?: string;
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
  const { attachments, smtpConfig, emailSender, ...rest } = options;
  return {
    ...rest,
    smtpConfig: smtpConfig ? { user: smtpConfig.user, pass: smtpConfig.pass, displayName: smtpConfig.displayName, signatureHtml: smtpConfig.signatureHtml } : undefined,
    // Note: emailSender is NOT serialized (tokens are ephemeral, must be re-resolved)
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
): Promise<{ scheduled: boolean; messageId?: string; gmailMessageId?: string; gmailThreadId?: string }> {
  // Always send immediately (time restrictions removed)
  const result = await sendEmail(options);
  return {
    scheduled: false,
    messageId: result.messageId,
    gmailMessageId: result.gmailMessageId,
    gmailThreadId: result.gmailThreadId,
  };
}

// ── Gmail API sending (OAuth path) ─────────────────────────

/**
 * Build an RFC 2822 MIME message with optional attachments.
 */
function buildMimeMessage(options: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const hasAttachments = options.attachments && options.attachments.length > 0;

  const headers: string[] = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    ...(options.cc ? [`Cc: ${options.cc}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    ...(options.replyTo ? [`Reply-To: ${options.replyTo}`] : []),
    ...(options.inReplyTo ? [`In-Reply-To: ${options.inReplyTo}`] : []),
    ...(options.references?.length ? [`References: ${options.references.join(" ")}`] : []),
  ];

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const textBoundary = `text_${boundary}`;
    let body = `\r\n--${boundary}\r\n`;
    body += `Content-Type: multipart/alternative; boundary="${textBoundary}"\r\n\r\n`;

    // Plain text part
    body += `--${textBoundary}\r\n`;
    body += `Content-Type: text/plain; charset=UTF-8\r\n`;
    body += `Content-Transfer-Encoding: base64\r\n\r\n`;
    body += Buffer.from(options.text).toString("base64") + "\r\n";

    // HTML part
    if (options.html) {
      body += `--${textBoundary}\r\n`;
      body += `Content-Type: text/html; charset=UTF-8\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      body += Buffer.from(options.html).toString("base64") + "\r\n";
    }

    body += `--${textBoundary}--\r\n`;

    // Attachments
    for (const att of options.attachments!) {
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${att.contentType || "application/octet-stream"}; name="${att.filename}"\r\n`;
      body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      body += att.content.toString("base64") + "\r\n";
    }

    body += `--${boundary}--`;
    return headers.join("\r\n") + "\r\n" + body;
  } else {
    // No attachments: multipart/alternative only
    const altBoundary = `alt_${boundary}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    let body = "\r\n";
    body += `--${altBoundary}\r\n`;
    body += `Content-Type: text/plain; charset=UTF-8\r\n`;
    body += `Content-Transfer-Encoding: base64\r\n\r\n`;
    body += Buffer.from(options.text).toString("base64") + "\r\n";

    if (options.html) {
      body += `--${altBoundary}\r\n`;
      body += `Content-Type: text/html; charset=UTF-8\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      body += Buffer.from(options.html).toString("base64") + "\r\n";
    }

    body += `--${altBoundary}--`;
    return headers.join("\r\n") + "\r\n" + body;
  }
}

/**
 * Send email via Gmail API using OAuth access token.
 */
async function sendViaGmailApi(
  sender: OAuthSender,
  options: SendEmailOptions,
  fromHeader: string,
  text: string,
  html: string | undefined,
): Promise<{ messageId: string; gmailMessageId?: string; gmailThreadId?: string }> {
  const mime = buildMimeMessage({
    from: fromHeader,
    to: options.to,
    cc: options.cc,
    subject: options.subject,
    text,
    html,
    replyTo: options.replyTo || sender.fromEmail,
    inReplyTo: options.inReplyTo,
    references: options.references,
    attachments: options.attachments,
  });

  // Base64url encode the MIME message
  const raw = Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sender.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gmail API send failed (${res.status}): ${err.error?.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  const gmailMessageId = data.id as string | undefined;
  const gmailThreadId = data.threadId as string | undefined;

  // Update last_used_at
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  await supabase
    .from("google_accounts")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", sender.userId);

  // Log to sent_emails for traceability
  await supabase.from("sent_emails").insert({
    user_id: sender.userId,
    gmail_message_id: gmailMessageId,
    gmail_thread_id: gmailThreadId,
    to: options.to,
    cc: options.cc || null,
    subject: options.subject,
    entity_type: options.entityType || null,
    entity_id: options.entityId || null,
  });

  return {
    messageId: gmailMessageId || "",
    gmailMessageId,
    gmailThreadId,
  };
}

// ── Main send function ─────────────────────────────────────

export async function sendEmail(options: SendEmailOptions): Promise<{
  messageId: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
}> {
  const sender = options.emailSender;
  const config = options.smtpConfig;

  // Determine from header and signature
  let fromEmail: string;
  let fromName: string;
  let signatureHtml: string;
  let signatureText: string;

  if (sender) {
    fromEmail = sender.fromEmail;
    fromName = sender.displayName;
    signatureHtml = sender.signatureHtml || DEFAULT_SIGNATURE_HTML;
    signatureText = `\n--\n${sender.displayName}\nPrototipalo.com`;
  } else if (config) {
    fromEmail = config.user;
    fromName = config.displayName;
    signatureHtml = config.signatureHtml || DEFAULT_SIGNATURE_HTML;
    signatureText = `\n--\n${config.displayName}\nPrototipalo.com`;
  } else {
    // Global transporter (system emails only)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP_USER y SMTP_PASS deben estar configurados en las variables de entorno");
    }
    fromEmail = process.env.SMTP_USER;
    fromName = "Prototipalo";
    signatureHtml = DEFAULT_SIGNATURE_HTML;
    signatureText = DEFAULT_SIGNATURE_TEXT;
  }

  const includeSignature = options.signature !== false;
  const text = includeSignature ? options.text + signatureText : options.text;
  const html = options.html
    ? (includeSignature ? options.html + signatureHtml : options.html)
    : undefined;

  const fromHeader = `"${fromName}" <${fromEmail}>`;

  // OAuth path: Gmail API
  if (sender?.type === "oauth") {
    return sendViaGmailApi(sender, options, fromHeader, text, html);
  }

  // SMTP path: Nodemailer (legacy or global)
  let transporter: nodemailer.Transporter;

  if (config) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.user, pass: config.pass },
    });
  } else if (sender?.type === "smtp") {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: sender.user, pass: sender.pass },
    });
  } else {
    transporter = globalTransporter;
  }

  const headers: Record<string, string> = {};
  if (options.inReplyTo) headers["In-Reply-To"] = options.inReplyTo;
  if (options.references?.length) headers["References"] = options.references.join(" ");

  const result = await transporter.sendMail({
    from: fromHeader,
    to: options.to,
    cc: options.cc || undefined,
    subject: options.subject,
    text,
    html,
    replyTo: options.replyTo || fromEmail,
    headers,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      contentDisposition: "attachment" as const,
    })),
  });

  return { messageId: result.messageId };
}
