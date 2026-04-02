import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getGmailClient, parseMessage } from "@/lib/gmail/client";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
import { sendPushForEvent } from "@/lib/push-notifications/server";

const GONZALO_USER_ID = "9a7664db-917a-424b-af30-87d0bc3725ff";
const ACCEPTED_INBOXES = ["info@prototipalo.com"];

/**
 * POST /api/webhooks/gmail-push
 *
 * Called by Google Cloud Pub/Sub when Gmail has new messages.
 * The notification only says "there are changes" — we fetch messages via Gmail API.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Pub/Sub wraps the message in { message: { data, messageId, publishTime } }
    const pubsubMessage = body?.message;
    if (!pubsubMessage?.data) {
      return NextResponse.json({ ok: true, reason: "no_data" });
    }

    // Decode base64 data — contains { emailAddress, historyId }
    const decoded = JSON.parse(
      Buffer.from(pubsubMessage.data, "base64").toString("utf-8"),
    );
    const newHistoryId = decoded.historyId;

    if (!newHistoryId) {
      return NextResponse.json({ ok: true, reason: "no_history_id" });
    }

    const supabase = createServiceClient();

    // Get the last processed historyId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: state } = await (supabase as any)
      .from("app_state")
      .select("value")
      .eq("key", "gmail_history_id")
      .single();

    const lastHistoryId = (state as { value: string } | null)?.value || null;

    // Save new historyId immediately to avoid reprocessing on retries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("app_state").upsert({
      key: "gmail_history_id",
      value: newHistoryId,
      updated_at: new Date().toISOString(),
    });

    if (!lastHistoryId) {
      // First run — just store the historyId, don't process backlog
      console.log("[gmail-push] First run, stored historyId:", newHistoryId);
      return NextResponse.json({ ok: true, reason: "initial_sync" });
    }

    // Fetch new messages since last historyId
    const gmail = getGmailClient();
    let messageIds: string[] = [];

    try {
      const history = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });

      const records = history.data.history || [];
      for (const record of records) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            messageIds.push(added.message.id);
          }
        }
      }
    } catch (historyErr: any) {
      // 404 = historyId expired (>7 days gap). Do a fresh sync of recent unread.
      if (historyErr?.code === 404) {
        console.warn("[gmail-push] historyId expired, fetching recent unread");
        const list = await gmail.users.messages.list({
          userId: "me",
          q: "is:unread in:inbox",
          maxResults: 10,
        });
        messageIds = (list.data.messages || []).map((m) => m.id!).filter(Boolean);
      } else {
        throw historyErr;
      }
    }

    if (messageIds.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // Deduplicate
    messageIds = [...new Set(messageIds)];

    let processed = 0;

    for (const msgId of messageIds) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: msgId,
          format: "full",
        });

        const parsed = parseMessage(msg.data);

        // Only process emails addressed to our accepted inboxes
        const allRecipients = `${parsed.to}, ${parsed.cc}`;
        if (!ACCEPTED_INBOXES.some((inbox) => allRecipients.includes(inbox))) {
          continue;
        }

        // Skip internal senders
        const fromDomain = parsed.from.split("@")[1] || "";
        if (fromDomain === "prototipalo.com") continue;

        // Run through spam filter
        if (isSpam(parsed)) continue;

        // Process the email as a lead (pass Gmail threadId for reliable threading)
        await processEmailAsLead(supabase, parsed, msg.data.threadId || undefined);
        processed++;
      } catch (msgErr) {
        console.error(`[gmail-push] Error processing message ${msgId}:`, msgErr);
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[gmail-push] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── SPAM FILTER ─────────────────────────────────────────────────

function isSpam(email: { from: string; subject: string; body: string }): boolean {
  const fromDomain = email.from.split("@")[1] || "";
  const fromLocal = email.from.split("@")[0] || "";
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase();

  // Automated local parts
  const spamLocalParts = [
    "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
    "newsletter", "newsletters", "news", "mailer", "mailer-daemon",
    "notifications", "notification", "alert", "alerts",
    "marketing", "promo", "promotions", "updates",
    "bounce", "postmaster", "daemon", "comunicacion",
    "comunicaciones", "digest", "suscripciones", "subscriptions",
    "support", "soporte", "billing", "facturacion", "invoice",
    "receipts", "receipt", "account", "accounts", "team",
    "automailer", "auto", "system", "sistema", "admin",
    "security", "seguridad", "verify", "confirm", "welcome",
    "bienvenido", "feedback", "survey", "encuesta",
    "orden", "order", "orders", "pedido", "pedidos",
    "envio", "envios", "shipping", "delivery", "tracking",
  ];
  if (spamLocalParts.some((p) => fromLocal === p || fromLocal.startsWith(p + "+"))) {
    return true;
  }

  // Marketing subdomains
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
    return true;
  }

  // Known service/SaaS domains
  const spamDomains = [
    "mailchimp.com", "mandrillapp.com", "sendgrid.net", "sendgrid.com",
    "sendinblue.com", "brevo.com", "mailgun.org", "mailgun.com",
    "constantcontact.com", "hubspot.com", "hubspotmail.com",
    "amazonses.com", "mailjet.com", "campaignmonitor.com",
    "getresponse.com", "activecampaign.com", "convertkit.com",
    "klaviyo.com", "drip.com", "mailerlite.com", "benchmark.email",
    "exacttarget.com", "salesforce.com", "pardot.com",
    "createsend.com", "cmail19.com", "cmail20.com",
    "outreach.io", "salesloft.com",
    "google.com", "googlemail.com", "google.es",
    "linkedin.com", "linkedinmail.com",
    "facebookmail.com", "facebook.com", "meta.com",
    "twitter.com", "x.com", "instagram.com", "tiktok.com", "pinterest.com",
    "microsoft.com", "microsoftonline.com", "office365.com",
    "office.com", "outlook.com", "teams.microsoft.com",
    "apple.com", "icloud.com",
    "github.com", "gitlab.com", "bitbucket.org", "atlassian.com",
    "jira.com", "confluence.com",
    "notion.so", "slack.com", "slackbot.com",
    "figma.com", "canva.com",
    "vercel.com", "netlify.com", "heroku.com", "render.com",
    "supabase.io", "supabase.com",
    "stripe.com", "paypal.com", "paypal.es",
    "intercom.io", "intercom.com", "zendesk.com", "freshdesk.com",
    "airtable.com", "monday.com", "asana.com",
    "trello.com", "clickup.com",
    "zoom.us", "zoom.com", "calendly.com", "typeform.com",
    "docusign.com", "docusign.net",
    "dropbox.com", "box.com",
    "bbva.com", "bbva.es", "santander.com", "santander.es",
    "caixabank.com", "caixabank.es", "bankinter.com",
    "ing.es", "ing.com", "openbank.es",
    "wise.com", "revolut.com", "n26.com",
    "dhl.com", "fedex.com", "ups.com", "usps.com",
    "correos.es", "correos.com",
    "seur.com", "seur.es", "mrw.es", "nacex.es", "gls-spain.es",
    "amazon.com", "amazon.es",
    "godaddy.com", "namecheap.com", "ovh.com", "ovh.es",
    "ionos.com", "ionos.es", "arsys.es", "dinahosting.com",
    "cloudflare.com",
    "agenciatributaria.es", "seg-social.es", "hacienda.gob.es", "boe.es",
    "uber.com", "cabify.com", "glovo.com",
    "spotify.com", "netflix.com",
    "holded.com",
  ];
  if (spamDomains.some((d) => fromDomain === d || fromDomain.endsWith("." + d))) {
    return true;
  }

  // Subject keywords
  const spamSubjectKeywords = [
    "unsubscribe", "darse de baja", "anular suscripci",
    "webinar", "newsletter", "invitación webinar",
    "has been added to", "te has suscrito",
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
    "oferta especial", "special offer", "descuento exclusivo",
    "última oportunidad", "last chance", "act now",
    "free trial", "prueba gratis", "prueba gratuita",
    "black friday", "cyber monday",
    "suspicious sign-in", "inicio de sesión sospechoso",
    "new sign-in", "nuevo inicio de sesión",
    "security alert", "alerta de seguridad",
  ];
  if (spamSubjectKeywords.some((kw) => subjectLower.includes(kw))) {
    return true;
  }

  // Body spam indicators (need 2+ matches)
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
  const bodyHits = spamBodyIndicators.filter((ind) => bodyLower.includes(ind)).length;
  if (bodyHits >= 2) return true;

  return false;
}

// ── LEAD PROCESSING ─────────────────────────────────────────────

async function processEmailAsLead(
  supabase: ReturnType<typeof createServiceClient>,
  email: {
    from: string;
    from_name: string;
    subject: string;
    body: string;
    message_id: string | null;
    in_reply_to: string | null;
    date: string;
  },
  gmailThreadId?: string,
) {
  const from = email.from;

  // Check blocked senders
  const fromDomain = from.split("@")[1] || "";
  const { data: blocked } = await supabase
    .from("blocked_emails")
    .select("id")
    .or(`email.ilike.${from},email.ilike.@${fromDomain}`)
    .limit(1)
    .single();

  if (blocked) return;

  // Find existing lead
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
    // Deduplication window
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
          full_name: email.from_name !== from ? email.from_name : from.split("@")[0],
          email: from,
          message: `[${email.subject}]\n\n${email.body}`.slice(0, 5000),
          source: "email",
          status: "new",
          owned_by: GONZALO_USER_ID,
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .ilike("email", from)
            .limit(1)
            .single();
          if (existing) {
            leadId = existing.id;
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      } else {
        leadId = newLead.id;
        isNewLead = true;
      }
    }
  }

  // Resolve thread_id — prefer Gmail's native threadId for reliable conversation grouping
  let threadId: string | null = null;

  // JSONB arrow filters (metadata->>key) require untyped client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untypedSupabase = supabase as any;

  if (gmailThreadId) {
    // Check if we already have activities with this Gmail threadId
    const { data: existingThread } = await untypedSupabase
      .from("lead_activities")
      .select("thread_id")
      .eq("metadata->>gmail_thread_id", gmailThreadId)
      .not("thread_id", "is", null)
      .limit(1)
      .single();

    threadId = (existingThread as { thread_id: string } | null)?.thread_id || `gmail-${gmailThreadId}`;
  } else if (email.in_reply_to) {
    const { data: parentActivity } = await untypedSupabase
      .from("lead_activities")
      .select("thread_id")
      .eq("metadata->>message_id", email.in_reply_to)
      .not("thread_id", "is", null)
      .limit(1)
      .single();
    if (parentActivity) threadId = (parentActivity as { thread_id: string }).thread_id;
  }

  if (!threadId) {
    threadId = email.message_id || `auto-${Date.now()}`;
  }

  // Insert activity
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_received",
    content: email.body,
    thread_id: threadId,
    metadata: {
      message_id: email.message_id,
      gmail_thread_id: gmailThreadId || null,
      email_from: from,
      email_from_name: email.from_name,
      email_subject: email.subject,
      in_reply_to: email.in_reply_to,
    },
    created_at: email.date,
    created_by: null,
  });

  if (error) {
    if (error.code === "23505") return; // duplicate
    throw error;
  }

  // Auto-detect project type tag
  if (isNewLead || !lead?.project_type_tag) {
    detectProjectTypeTag(email.body)
      .then(async (tag) => {
        if (tag) {
          await supabase.from("leads").update({ project_type_tag: tag }).eq("id", leadId);
        }
      })
      .catch((err) => console.error("Lead tagger error:", err));
  }

  // AI draft
  if (isNewLead) {
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
          email.body,
        );
      }
    })().catch((err) => console.error("AI draft error:", err));
  }

  // Push notification for new leads
  if (isNewLead) {
    const displayName = email.from_name !== from ? email.from_name : from.split("@")[0];
    sendPushForEvent("email_received", {
      title: `📧 ${displayName}`,
      body: email.subject.slice(0, 120) || "Nuevo lead por email",
      url: `/dashboard/crm/${leadId}`,
    }).catch((err) => console.error("Push notification error:", err));
  }
}
