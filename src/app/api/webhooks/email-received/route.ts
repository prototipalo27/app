import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
import { sendPushForEvent } from "@/lib/push-notifications/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function logWebhook(
  method: string,
  headers: Record<string, string>,
  body: string
) {
  try {
    const supabase = getSupabase();
    await supabase.from("webhook_logs").insert({
      endpoint: "/api/webhooks/email-received",
      method,
      headers,
      body,
    });
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

const GONZALO_USER_ID = "9a7664db-917a-424b-af30-87d0bc3725ff";

/**
 * POST /api/webhooks/email-received?secret=EMAIL_WEBHOOK_SECRET
 *
 * Receives email data from n8n (IMAP trigger) and logs activities on existing leads.
 * If no matching lead exists, auto-creates one with source="email".
 *
 * Body:
 * {
 *   "from": "cliente@example.com",
 *   "from_name": "Juan",
 *   "to": "info@prototipalo.com",
 *   "cc": "",
 *   "subject": "Re: Presupuesto",
 *   "body": "Hola, me interesa...",
 *   "message_id": "<abc@gmail.com>",
 *   "in_reply_to": "<xyz@gmail.com>",
 *   "date": "2026-02-13T10:00:00Z"
 * }
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headerObj: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headerObj[k] = v;
  });

  await logWebhook("POST", headerObj, rawBody);

  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody);

    const from = (payload.from || "").toLowerCase().trim();
    const fromName = payload.from_name || from;
    const subject = payload.subject || "(sin asunto)";
    const body = (payload.body || "").slice(0, 10_000);
    const messageId = payload.message_id || null;
    const inReplyTo = payload.in_reply_to || null;
    const date = payload.date || new Date().toISOString();

    if (!from) {
      return NextResponse.json(
        { ok: false, reason: "missing_from" },
        { status: 400 }
      );
    }

    // ── RECIPIENT FILTER ────────────────────────────────────────
    // Only process emails sent to info@prototipalo.com (the shared inbox).
    // Emails to personal addresses (manu@, gonzalo@, etc.) are ignored.
    const to = (payload.to || "").toLowerCase().trim();
    const cc = (payload.cc || "").toLowerCase().trim();
    const allRecipients = `${to}, ${cc}`;
    const ACCEPTED_INBOXES = ["info@prototipalo.com"];
    const isTargetedToInfo = ACCEPTED_INBOXES.some((inbox) => allRecipients.includes(inbox));

    if (!isTargetedToInfo) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "not_addressed_to_info",
      });
    }

    const supabase = getSupabase();

    // ── SPAM / MARKETING FILTER ──────────────────────────────────
    const fromDomain = from.split("@")[1] || "";
    const fromLocal = from.split("@")[0] || "";

    // 1. Skip internal domains
    const skipDomains = [
      "prototipalo.com",
      "webflow.com",
      "support.webflow.com",
    ];
    if (skipDomains.some((d) => fromDomain === d || fromDomain.endsWith("." + d))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "internal_or_notification_sender",
      });
    }

    // 2. Skip known marketing/automated local parts
    const spamLocalParts = [
      "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
      "newsletter", "newsletters", "news", "mailer", "mailer-daemon",
      "notifications", "notification", "alert", "alerts",
      "marketing", "promo", "promotions", "updates",
      "bounce", "postmaster", "daemon", "info", "comunicacion",
      "comunicaciones", "digest", "suscripciones", "subscriptions",
      "support", "soporte", "billing", "facturacion", "invoice",
      "receipts", "receipt", "account", "accounts", "team",
      "hello", "hola", "contacto", "contact", "ventas", "sales",
      "automailer", "auto", "system", "sistema", "admin",
      "security", "seguridad", "verify", "confirm", "welcome",
      "bienvenido", "feedback", "survey", "encuesta",
      "orden", "order", "orders", "pedido", "pedidos",
      "envio", "envios", "shipping", "delivery", "tracking",
    ];
    if (spamLocalParts.some((p) => fromLocal === p || fromLocal.startsWith(p + "+"))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "automated_sender",
      });
    }

    // 3. Skip marketing subdomains (message.X, mail.X, email.X, news.X, etc.)
    const marketingSubdomainPrefixes = [
      "message.", "messages.", "mail.", "email.", "e-mail.",
      "news.", "newsletter.", "marketing.", "promo.", "campaign.",
      "campaigns.", "bulk.", "send.", "sender.", "mailing.",
      "notify.", "notification.", "bounce.", "track.", "click.",
      "links.", "go.", "t.", "em.", "em-", "post.",
      "updates.", "alerts.", "info.", "service.", "noreply.",
      "auto.", "system.", "mailer.", "transactional.",
    ];
    if (marketingSubdomainPrefixes.some((p) => fromDomain.startsWith(p))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "marketing_subdomain",
      });
    }

    // 4. Skip known mass-email platform domains AND service/SaaS notification domains
    const spamDomains = [
      // Mass email platforms
      "mailchimp.com", "mandrillapp.com", "sendgrid.net", "sendgrid.com",
      "sendinblue.com", "brevo.com", "mailgun.org", "mailgun.com",
      "constantcontact.com", "hubspot.com", "hubspotmail.com",
      "amazonses.com", "mailjet.com", "campaignmonitor.com",
      "getresponse.com", "activecampaign.com", "convertkit.com",
      "klaviyo.com", "drip.com", "mailerlite.com", "benchmark.email",
      "exacttarget.com", "salesforce.com", "pardot.com",
      "createsend.com", "cmail19.com", "cmail20.com",
      "outreach.io", "salesloft.com",
      // Google / workspace
      "google.com", "googlemail.com", "google.es",
      "accounts.google.com", "calendar-notification.google.com",
      // Social media
      "linkedin.com", "linkedinmail.com",
      "facebookmail.com", "facebook.com", "meta.com",
      "twitter.com", "x.com",
      "instagram.com",
      "tiktok.com",
      "pinterest.com",
      // Microsoft
      "microsoft.com", "microsoftonline.com", "office365.com",
      "office.com", "outlook.com", "teams.microsoft.com",
      // Apple
      "apple.com", "icloud.com",
      // Dev / SaaS
      "github.com", "gitlab.com", "bitbucket.org", "atlassian.com",
      "jira.com", "confluence.com",
      "notion.so", "slack.com", "slackbot.com",
      "figma.com", "canva.com",
      "vercel.com", "netlify.com", "heroku.com", "render.com",
      "supabase.io", "supabase.com",
      "stripe.com", "paypal.com", "paypal.es",
      "intercom.io", "intercom.com", "zendesk.com", "freshdesk.com",
      "notion.so", "airtable.com", "monday.com", "asana.com",
      "trello.com", "clickup.com",
      "zoom.us", "zoom.com",
      "calendly.com",
      "typeform.com",
      "docusign.com", "docusign.net",
      "dropbox.com", "box.com",
      // Banks / finance
      "bbva.com", "bbva.es", "santander.com", "santander.es",
      "caixabank.com", "caixabank.es", "bankinter.com",
      "ing.es", "ing.com", "openbank.es",
      "wise.com", "revolut.com", "n26.com",
      // Shipping / logistics
      "dhl.com", "fedex.com", "ups.com", "usps.com",
      "correos.es", "correos.com",
      "seur.com", "seur.es", "mrw.es", "nacex.es", "gls-spain.es",
      "amazon.com", "amazon.es",
      // Hosting / registrars
      "godaddy.com", "namecheap.com", "ovh.com", "ovh.es",
      "ionos.com", "ionos.es", "arsys.es", "dinahosting.com",
      "cloudflare.com",
      // Government / legal
      "agenciatributaria.es", "seg-social.es", "hacienda.gob.es",
      "boe.es",
      // Misc services
      "uber.com", "cabify.com", "glovo.com",
      "spotify.com", "netflix.com",
      "holded.com",
    ];
    if (spamDomains.some((d) => fromDomain === d || fromDomain.endsWith("." + d))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "mass_email_platform",
      });
    }

    // 5. Skip by spam keywords in subject (case-insensitive)
    const subjectLower = subject.toLowerCase();
    const spamSubjectKeywords = [
      // Unsubscribe / newsletters
      "unsubscribe", "darse de baja", "anular suscripci",
      "webinar", "newsletter", "invitación webinar",
      "has been added to", "te has suscrito",
      // Notifications
      "notificación de", "notification from", "alerta de",
      "recordatorio:", "reminder:",
      "your receipt", "tu recibo", "your invoice", "tu factura",
      "payment received", "pago recibido",
      "password reset", "restablecer contraseña", "cambiar contraseña",
      "verify your email", "verifica tu email", "confirma tu email",
      "confirm your account", "confirma tu cuenta",
      "welcome to", "bienvenido a",
      "your order", "tu pedido", "tu envío", "your shipment",
      "out of office", "fuera de la oficina", "autoreply", "auto-reply",
      "respuesta automática",
      // Marketing
      "oferta especial", "special offer", "descuento exclusivo",
      "última oportunidad", "last chance", "act now",
      "free trial", "prueba gratis", "prueba gratuita",
      "black friday", "cyber monday",
      // Security alerts
      "suspicious sign-in", "inicio de sesión sospechoso",
      "new sign-in", "nuevo inicio de sesión",
      "security alert", "alerta de seguridad",
    ];
    if (spamSubjectKeywords.some((kw) => subjectLower.includes(kw))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "spam_subject_keyword",
      });
    }

    // 6. Skip reply-to addresses that look like bulk hashes (reply-XXXXXXXXXXX@...)
    const replyTo = (payload.reply_to || payload.in_reply_to_address || "").toLowerCase();
    if (/^reply-[a-z0-9]{16,}@/.test(replyTo)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "bulk_reply_to_hash",
      });
    }

    // 7. Skip emails with unsubscribe indicators in the body
    const bodyLower = body.toLowerCase();
    const spamBodyIndicators = [
      "unsubscribe", "darse de baja", "click here to unsubscribe",
      "email preferences", "preferencias de email",
      "manage your subscription", "gestionar suscripción",
      "you are receiving this email because",
      "recibes este email porque", "recibes este correo porque",
      "this is an automated message", "este es un mensaje automático",
      "do not reply to this email", "no respondas a este correo",
      "list-unsubscribe",
    ];
    const bodyIndicatorCount = spamBodyIndicators.filter((ind) => bodyLower.includes(ind)).length;
    if (bodyIndicatorCount >= 2) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "spam_body_indicators",
      });
    }

    // Check if this sender is blocked (exact email or @domain)
    const { data: blocked } = await supabase
      .from("blocked_emails")
      .select("id")
      .or(`email.ilike.${from},email.ilike.@${fromDomain}`)
      .limit(1)
      .single();

    if (blocked) {
      return NextResponse.json({
        ok: true,
        blocked: true,
        reason: "sender_blocked",
      });
    }

    // Find lead by sender email
    const { data: lead } = await supabase
      .from("leads")
      .select("id, project_type_tag")
      .ilike("email", from)
      .limit(1)
      .single();

    let leadId: string;
    let isNewLead = false;

    if (lead) {
      leadId = lead.id;
    } else {
      // Auto-create lead from email
      // Deduplication: check if a lead with this email was created in the last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentLead } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", from)
        .gte("created_at", fiveMinAgo)
        .limit(1)
        .single();

      if (recentLead) {
        leadId = recentLead.id;
      } else {
        const { data: newLead, error: insertError } = await supabase
          .from("leads")
          .insert({
            full_name: fromName !== from ? fromName : from.split("@")[0],
            email: from,
            message: `[${subject}]\n\n${body}`.slice(0, 5000),
            source: "email",
            status: "new",
            owned_by: GONZALO_USER_ID,
          })
          .select("id")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            // Race condition: lead was just created by another request
            const { data: existing } = await supabase
              .from("leads")
              .select("id")
              .ilike("email", from)
              .limit(1)
              .single();
            if (existing) {
              leadId = existing.id;
            } else {
              console.error("Email webhook lead insert error:", insertError);
              return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
          } else {
            console.error("Email webhook lead insert error:", insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        } else {
          leadId = newLead.id;
          isNewLead = true;
        }
      }
    }

    // Resolve thread_id
    let threadId: string | null = null;

    if (inReplyTo) {
      // Look for an existing activity with this message_id
      const { data: parentActivity } = await supabase
        .from("lead_activities")
        .select("thread_id")
        .eq("metadata->>message_id", inReplyTo)
        .not("thread_id", "is", null)
        .limit(1)
        .single();

      if (parentActivity) {
        threadId = parentActivity.thread_id;
      }
    }

    // If no thread found, start a new thread with this message's ID
    if (!threadId) {
      threadId = messageId || `auto-${Date.now()}`;
    }

    // Insert activity (unique index on message_id prevents duplicates)
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "email_received",
      content: body,
      thread_id: threadId,
      metadata: {
        message_id: messageId,
        email_from: from,
        email_from_name: fromName,
        email_subject: subject,
        in_reply_to: inReplyTo,
      },
      created_at: date,
      created_by: null,
    });

    if (error) {
      // 23505 = unique_violation (duplicate message_id)
      if (error.code === "23505") {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          lead_id: leadId,
        });
      }
      console.error("Email webhook insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-detect project type tag if lead doesn't have one
    if (isNewLead || !lead?.project_type_tag) {
      detectProjectTypeTag(body)
        .then(async (tag) => {
          if (tag) {
            await supabase.from("leads").update({ project_type_tag: tag }).eq("id", leadId);
          }
        })
        .catch((err) => console.error("Lead tagger error:", err));
    }

    // Generate AI reply draft in background (non-blocking)
    (async () => {
      const { data: leadData } = await supabase
        .from("leads")
        .select("full_name, company, message")
        .eq("id", leadId)
        .single();
      if (leadData) {
        await generateAndSaveDraft(
          leadId,
          { fullName: leadData.full_name, company: leadData.company, message: leadData.message },
          body
        );
      }
    })().catch((err) => console.error("AI draft error:", err));

    // Send push notification for new leads created from email
    if (isNewLead) {
      const displayName = fromName !== from ? fromName : from.split("@")[0];
      sendPushForEvent("email_received", {
        title: `📧 ${displayName}`,
        body: subject.slice(0, 120) || "Nuevo lead por email",
        url: `/dashboard/crm/${leadId}`,
      }).catch((err) => console.error("Push notification error:", err));
    }

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      thread_id: threadId,
      created: isNewLead,
    });
  } catch (err) {
    console.error("Email webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
