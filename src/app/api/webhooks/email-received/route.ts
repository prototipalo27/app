import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

/**
 * POST /api/webhooks/email-received?secret=EMAIL_WEBHOOK_SECRET
 *
 * Receives email data from n8n (IMAP trigger) and logs activities on existing leads.
 * Does NOT auto-create leads — leads only enter via Webflow form or manual creation.
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
      "marketing", "promo", "promotions", "info", "updates",
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
      .select("id")
      .ilike("email", from)
      .limit(1)
      .single();

    let leadId: string;

    if (lead) {
      leadId = lead.id;
    } else {
      // No auto-create leads from email — leads only enter via Webflow or manual creation.
      // n8n does not send the "to" field so we can't distinguish info@ from manu@ or spam.
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_matching_lead",
      });
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

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      thread_id: threadId,
    });
  } catch (err) {
    console.error("Email webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
