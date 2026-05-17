import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getGmailClient,
  parseMessage,
  extractAttachments,
  downloadGmailAttachment,
  type EmailAttachmentRef,
} from "@/lib/gmail/client";
import { uploadFile } from "@/lib/google-drive/client";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
import { sendPushForEvent } from "@/lib/push-notifications/server";
import { checkSpam } from "@/lib/email-spam-filter";
import { processInvoiceEmail } from "@/lib/invoice-processor";
import type { gmail_v1 } from "googleapis";

const GONZALO_USER_ID = "9a7664db-917a-424b-af30-87d0bc3725ff";
const ACCEPTED_INBOXES = ["info@prototipalo.com"];
const INVOICE_INBOX = "administracion@prototipalo.com";

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
      .from("app_metadata")
      .select("value")
      .eq("key", "gmail_history_id")
      .single();

    const lastHistoryId = (state as { value: string } | null)?.value || null;

    // Save new historyId immediately to avoid reprocessing on retries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("app_metadata").upsert({
      key: "gmail_history_id",
      value: newHistoryId,
      updated_at: new Date().toISOString(),
    });

    if (!lastHistoryId) {
      // First run — just store the historyId, don't process backlog
      return NextResponse.json({ ok: true, reason: "initial_sync" });
    }

    // Fetch new messages since last historyId (manu@ inbox, filtering for info@)
    const gmail = getGmailClient("manu@prototipalo.com");
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
        const allRecipients = `${parsed.to}, ${parsed.cc}`;

        // Route: invoice emails to administracion@
        if (allRecipients.includes(INVOICE_INBOX)) {
          await processInvoiceEmail(gmail, msg.data);
          processed++;
          continue;
        }

        // Route: lead emails to info@
        if (!ACCEPTED_INBOXES.some((inbox) => allRecipients.includes(inbox))) {
          continue;
        }

        // Google Group "Info" rewrites From to info@prototipalo.com (DMARC).
        // Recover the real sender from X-Original-Sender or Reply-To.
        const effective = unwrapGroupSender(parsed);

        // Skip internal senders
        const fromDomain = effective.from.split("@")[1] || "";
        if (fromDomain === "prototipalo.com") continue;

        // Run through spam filter
        if (checkSpam({
          from: effective.from,
          subject: parsed.subject,
          body: parsed.body,
          reply_to: parsed.reply_to || undefined,
        }).spam) continue;

        // Process the email as a lead (pass Gmail threadId for reliable threading)
        await processEmailAsLead(
          supabase,
          { ...parsed, from: effective.from, from_name: effective.from_name },
          msg.data.threadId || undefined,
          { gmail, messageId: msgId, attachments: extractAttachments(msg.data) },
        );
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

// ── GOOGLE GROUP UNWRAP ─────────────────────────────────────────

/**
 * When info@prototipalo.com (Google Group) redelivers an external email,
 * DMARC forces the From header to the group address. The original sender
 * is preserved in X-Original-Sender and Reply-To, and the display name is
 * suffixed with " via <Group>". This recovers the real external sender.
 */
function unwrapGroupSender(parsed: {
  from: string;
  from_name: string;
  reply_to: string | null;
  x_original_sender: string | null;
}): { from: string; from_name: string } {
  const fromDomain = parsed.from.split("@")[1] || "";
  if (fromDomain !== "prototipalo.com") {
    return { from: parsed.from, from_name: parsed.from_name };
  }
  const candidate = parsed.x_original_sender || parsed.reply_to;
  const candidateDomain = candidate ? candidate.split("@")[1] || "" : "";
  if (!candidate || candidateDomain === "prototipalo.com") {
    return { from: parsed.from, from_name: parsed.from_name };
  }
  // Strip the " via <Group>" suffix and surrounding quotes from the display name
  const cleanName = parsed.from_name
    .replace(/\s+via\s+[^<"']+$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return { from: candidate, from_name: cleanName || candidate.split("@")[0] };
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
  attachmentSource?: {
    gmail: gmail_v1.Gmail;
    messageId: string;
    attachments: EmailAttachmentRef[];
  },
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
          message: `[${email.subject}]\n\n${email.body}`.slice(0, 30000),
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

  // Forward attachments to Drive if a folder exists, otherwise buffer them in
  // Supabase Storage until the lead is qualified (fire-and-forget).
  if (attachmentSource && attachmentSource.attachments.length > 0) {
    handleIncomingAttachments(
      supabase,
      leadId,
      attachmentSource.gmail,
      attachmentSource.messageId,
      attachmentSource.attachments,
    ).catch((err) => console.error("[gmail-push] Attachment forwarding failed:", err));
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

  // Generate opportunity name (short 3-5 word nickname)
  if (isNewLead) {
    generateOpportunityName(email.subject, email.body, email.from_name)
      .then(async (name) => {
        if (name) {
          await supabase.from("leads").update({ opportunity_name: name }).eq("id", leadId);
        }
      })
      .catch((err) => console.error("Opportunity name error:", err));
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

// ── EMAIL ATTACHMENTS → DRIVE (if folder) / SUPABASE BUFFER (otherwise) ─

async function handleIncomingAttachments(
  supabase: ReturnType<typeof createServiceClient>,
  leadId: string,
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachments: EmailAttachmentRef[],
) {
  // Prefer the lead's own Drive folder (set on qualification). Fall back to
  // the linked project's folder for legacy leads that never had one.
  const { data: lead } = await supabase
    .from("leads")
    .select("google_drive_folder_id")
    .eq("id", leadId)
    .single();

  let folderId = lead?.google_drive_folder_id ?? null;

  if (!folderId) {
    const { data: project } = await supabase
      .from("projects")
      .select("google_drive_folder_id")
      .eq("lead_id", leadId)
      .not("google_drive_folder_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    folderId = project?.google_drive_folder_id ?? null;
  }

  for (const att of attachments) {
    try {
      const buffer = await downloadGmailAttachment(gmail, messageId, att.attachmentId);

      if (folderId) {
        await uploadFile(folderId, att.filename, att.mimeType, buffer);
      } else {
        // No folder yet — park the file in Supabase Storage. qualifyLead()
        // will drain the bucket into Drive when the lead leaves status=new.
        const storagePath = `${leadId}/${messageId}-${att.attachmentId}-${att.filename}`;
        const { error: uploadErr } = await supabase.storage
          .from("lead-attachments")
          .upload(storagePath, buffer, {
            contentType: att.mimeType,
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        await supabase.from("lead_attachments").insert({
          lead_id: leadId,
          source: "email",
          filename: att.filename,
          mime_type: att.mimeType,
          storage_path: storagePath,
          gmail_message_id: messageId,
        });
      }
    } catch (err) {
      console.error(`[gmail-push] Failed to handle "${att.filename}":`, err);
    }
  }
}

// ── OPPORTUNITY NAME ───────────────────────────────────────────

async function generateOpportunityName(
  subject: string,
  body: string,
  fromName: string,
): Promise<string | null> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `Eres un asistente de un taller de impresion 3D (Prototipalo). Genera un nombre corto (3-5 palabras) para esta oportunidad/lead, tipo mote informal para hablar de ellos en la oficina. Debe ser descriptivo del proyecto, no del cliente. Ejemplos: "Trofeos resina Anove", "Maqueta museo Valencia", "Piezas drone racing".

De: ${fromName}
Asunto: ${subject}
Mensaje: ${body.slice(0, 1000)}

Responde SOLO el nombre, nada mas.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return text || null;
}
