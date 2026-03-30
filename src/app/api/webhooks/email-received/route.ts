import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
import { sendPushToAll } from "@/lib/push-notifications/server";

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

    const supabase = getSupabase();

    // Skip emails from internal or notification senders
    const fromDomain = from.split("@")[1] || "";
    const fromLocal = from.split("@")[0] || "";
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

    // Skip noreply, newsletters, and automated senders
    const spamLocalParts = [
      "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
      "newsletter", "newsletters", "news", "mailer", "mailer-daemon",
      "notifications", "notification", "alert", "alerts",
      "marketing", "promo", "promotions", "updates",
      "bounce", "postmaster", "daemon",
    ];
    if (spamLocalParts.some((p) => fromLocal === p || fromLocal.startsWith(p + "+"))) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "automated_sender",
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
      sendPushToAll({
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
