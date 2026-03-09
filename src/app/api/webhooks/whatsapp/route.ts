import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push-notifications/server";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";

// Gonzalo — default commercial owner for WhatsApp leads
const GONZALO_USER_ID = "9a7664db-917a-424b-af30-87d0bc3725ff";

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const apiKey = request.headers.get("apikey");
  if (apiKey !== process.env.WHATSAPP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  // Evolution v2 sends event as "messages.upsert", v1 as "MESSAGES_UPSERT"
  const event = (body.event || "").toUpperCase().replace(/\./g, "_");
  const instanceName = body.instance;

  const supabase = createServiceClient();

  // Get instance from DB
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  try {
    switch (event) {
      case "CONNECTION_UPDATE":
        await handleConnectionUpdate(supabase, instance.id, body.data);
        break;
      case "MESSAGES_UPSERT": {
        // Evolution v2 may send data as a single object or as an array
        const messages = Array.isArray(body.data) ? body.data : [body.data];
        await handleMessagesUpsert(supabase, instance.id, messages);
        break;
      }
      case "MESSAGES_UPDATE": {
        const updates = Array.isArray(body.data) ? body.data : [body.data];
        await handleMessagesUpdate(supabase, updates);
        break;
      }
    }
  } catch (err) {
    console.error(`[WhatsApp Webhook] Error processing ${event}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleConnectionUpdate(
  supabase: ReturnType<typeof createServiceClient>,
  instanceId: string,
  data: { state: string }
) {
  const statusMap: Record<string, string> = {
    open: "connected",
    close: "disconnected",
    connecting: "connecting",
  };

  const status = statusMap[data.state] || "disconnected";

  await supabase
    .from("whatsapp_instances")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", instanceId);
}

async function handleMessagesUpsert(
  supabase: ReturnType<typeof createServiceClient>,
  instanceId: string,
  data: Array<{
    key: { remoteJid: string; fromMe: boolean; id: string };
    message?: { conversation?: string; extendedTextMessage?: { text?: string }; imageMessage?: { caption?: string }; videoMessage?: { caption?: string }; documentMessage?: { title?: string }; audioMessage?: unknown };
    pushName?: string;
    messageTimestamp?: number;
  }>
) {
  for (const msg of data) {
    const remoteJid = msg.key.remoteJid;
    // Skip status broadcasts and group messages
    if (remoteJid === "status@broadcast" || remoteJid?.endsWith("@g.us")) {
      continue;
    }

    const fromMe = msg.key.fromMe;
    const content = extractMessageContent(msg.message);
    const messageType = detectMessageType(msg.message);
    const contactPhone = remoteJid?.replace("@s.whatsapp.net", "");
    const contactName = msg.pushName || contactPhone;
    const timestamp = msg.messageTimestamp
      ? new Date(msg.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // Upsert conversation
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          instance_id: instanceId,
          remote_jid: remoteJid,
          contact_name: contactName,
          contact_phone: contactPhone,
          last_message_at: timestamp,
          last_message_preview: content?.substring(0, 100) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instance_id,remote_jid" }
      )
      .select("id")
      .single();

    if (!conversation) continue;

    // Insert message
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      remote_jid: remoteJid,
      from_me: fromMe,
      content,
      message_type: messageType,
      whatsapp_message_id: msg.key.id,
      status: fromMe ? "sent" : "delivered",
      timestamp,
    });

    // Increment unread count for incoming messages
    if (!fromMe) {
      await supabase.rpc("increment_unread", {
        conv_id: conversation.id,
      }).then(() => {}, () => {
        // Fallback: manual increment if RPC doesn't exist
        supabase
          .from("whatsapp_conversations")
          .update({ unread_count: (conversation as { unread_count?: number }).unread_count ? (conversation as { unread_count?: number }).unread_count! + 1 : 1 })
          .eq("id", conversation.id)
          .then(() => {}, () => {});
      });
    }

    // Auto-create lead when an outgoing message starts with "presu"
    if (fromMe && content && /^presu\b/i.test(content.trim())) {
      await maybeCreateLeadFromPresu(supabase, content.trim(), contactPhone, contactName);
    }
  }
}

async function handleMessagesUpdate(
  supabase: ReturnType<typeof createServiceClient>,
  data: Array<Record<string, unknown>>
) {
  for (const update of data) {
    const statusMap: Record<number, string> = {
      2: "sent",
      3: "delivered",
      4: "read",
    };

    const rawStatus = (update.update as { status?: number })?.status
      ?? (update.status as number | undefined)
      ?? 0;
    const status = statusMap[rawStatus];
    if (!status) continue;

    // Evolution v2 uses keyId at top level, v1 uses key.id
    const messageId = (update.keyId as string)
      || (update.key as { id?: string })?.id;
    if (!messageId) continue;

    await supabase
      .from("whatsapp_messages")
      .update({ status })
      .eq("whatsapp_message_id", messageId);
  }
}

/**
 * Parse a "presu" WhatsApp message and create a CRM lead.
 *
 * Supported formats:
 *   presu Nombre del cliente
 *   presu Nombre del cliente - Empresa
 *   presu Nombre del cliente - Empresa
 *   descripción del proyecto...
 *
 * Phone is taken from the WhatsApp contact (recipient).
 */
async function maybeCreateLeadFromPresu(
  supabase: ReturnType<typeof createServiceClient>,
  content: string,
  contactPhone: string | undefined,
  contactName: string | undefined
) {
  try {
    // Remove the "presu" prefix (case-insensitive)
    const body = content.replace(/^presu\s*/i, "").trim();
    if (!body) return; // empty after prefix — ignore

    // First line = name (and optionally "- Empresa"), rest = message
    const lines = body.split("\n");
    const firstLine = lines[0].trim();
    const restLines = lines.slice(1).map((l) => l.trim()).filter(Boolean).join("\n");

    let fullName = firstLine;
    let company: string | null = null;

    // If first line contains " - ", split into name and company
    const dashIdx = firstLine.indexOf(" - ");
    if (dashIdx > 0) {
      fullName = firstLine.substring(0, dashIdx).trim();
      company = firstLine.substring(dashIdx + 3).trim() || null;
    }

    if (!fullName) return;

    // Normalize phone for dedup: strip leading + and spaces
    const normalizedPhone = contactPhone?.replace(/[\s+\-]/g, "") || null;

    // Dedup: check if a lead with same phone already exists and is not won/lost
    if (normalizedPhone) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", normalizedPhone)
        .not("status", "in", '("won","lost")')
        .limit(1)
        .single();

      if (existing) {
        console.log(`[WhatsApp presu] Lead already exists for phone ${normalizedPhone}: ${existing.id}`);
        return;
      }
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        full_name: fullName,
        company,
        phone: normalizedPhone,
        message: restLines || null,
        source: "whatsapp",
        status: "new",
        owned_by: GONZALO_USER_ID,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[WhatsApp presu] Insert error:", error);
      return;
    }

    console.log(`[WhatsApp presu] Created lead ${lead.id}: ${fullName}`);

    // Auto-detect project type tag (background)
    detectProjectTypeTag(restLines || null)
      .then(async (tag) => {
        if (tag) {
          await supabase.from("leads").update({ project_type_tag: tag }).eq("id", lead.id);
        }
      })
      .catch((err) => console.error("[WhatsApp presu] Tagger error:", err));

    // Generate AI draft (background)
    generateAndSaveDraft(lead.id, {
      fullName,
      company: company || undefined,
      message: restLines || undefined,
    }).catch((err) => console.error("[WhatsApp presu] AI draft error:", err));

    // Notify all users
    const titleParts = [fullName, company].filter(Boolean);
    sendPushToAll({
      title: `📩 WhatsApp presu: ${titleParts.join(" - ")}`,
      body: restLines?.slice(0, 120) || "Nuevo lead desde WhatsApp",
      url: `/dashboard/crm/${lead.id}`,
      phone: normalizedPhone || undefined,
    }).catch((err) => console.error("[WhatsApp presu] Push error:", err));
  } catch (err) {
    console.error("[WhatsApp presu] Unexpected error:", err);
  }
}

function extractMessageContent(
  message?: Record<string, unknown>
): string | null {
  if (!message) return null;
  if (message.conversation) return message.conversation as string;
  if (message.extendedTextMessage)
    return (message.extendedTextMessage as { text?: string }).text || null;
  if (message.imageMessage)
    return (message.imageMessage as { caption?: string }).caption || "[Imagen]";
  if (message.videoMessage)
    return (message.videoMessage as { caption?: string }).caption || "[Video]";
  if (message.audioMessage) return "[Audio]";
  if (message.documentMessage)
    return (message.documentMessage as { title?: string }).title || "[Documento]";
  if (message.stickerMessage) return "[Sticker]";
  if (message.locationMessage) return "[Ubicación]";
  if (message.contactMessage) return "[Contacto]";
  return null;
}

function detectMessageType(message?: Record<string, unknown>): string {
  if (!message) return "text";
  if (message.imageMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage) return "audio";
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";
  if (message.locationMessage) return "location";
  if (message.contactMessage) return "contact";
  return "text";
}
