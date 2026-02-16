import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

/**
 * POST /api/webhooks/email-received?secret=EMAIL_WEBHOOK_SECRET
 *
 * Receives email data from n8n (IMAP trigger) and creates lead activities.
 * Auto-creates a lead if the sender email doesn't match any existing lead.
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
    const to = (payload.to || "").toLowerCase().trim();
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

    // Skip emails from @prototipalo.com (internal/outgoing)
    const fromDomain = from.split("@")[1];
    if (fromDomain === "prototipalo.com") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "internal_sender",
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
    let autoCreated = false;

    if (lead) {
      leadId = lead.id;
    } else {
      // Only auto-create leads from emails sent to info@prototipalo.com
      // If "to" is provided, check it; if not provided, skip auto-creation
      const isToInfo = to.includes("info@prototipalo.com");
      if (!isToInfo) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "not_to_info",
        });
      }

      // Auto-create lead from unknown sender
      const displayName = fromName !== from
        ? fromName
        : from.split("@")[0].replace(/[._-]/g, " ");

      const { data: newLead, error: createError } = await supabase
        .from("leads")
        .insert({
          full_name: displayName,
          email: from,
          source: "email",
          status: "new",
          message: body || null,
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Failed to auto-create lead:", createError);
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      leadId = newLead.id;
      autoCreated = true;

      // Notify team about new lead from email
      sendPushToAll({
        title: "Nuevo lead (email)",
        body: `${displayName} <${from}>`,
        url: `/dashboard/crm/${leadId}`,
      }).catch(() => {});
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
      auto_created: autoCreated,
      thread_id: threadId,
    });
  } catch (err) {
    console.error("Email webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
