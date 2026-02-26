"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { sendTextMessage } from "@/lib/evolution-api";

const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "prototipalo";

export async function sendMessage(
  conversationId: string,
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string | null }> {
  await requireRole("manager");
  const supabase = await createClient();

  try {
    // Send via Evolution API
    const result = await sendTextMessage(INSTANCE_NAME, phone, text);

    // Get conversation remote_jid
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("remote_jid, instance_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return { success: false, error: "Conversación no encontrada" };
    }

    // Save message to DB
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      remote_jid: conversation.remote_jid,
      from_me: true,
      content: text,
      message_type: "text",
      whatsapp_message_id: result?.key?.id || null,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    // Update conversation last message
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.substring(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    return { success: true, error: null };
  } catch (err) {
    console.error("[WhatsApp] Send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al enviar mensaje",
    };
  }
}

export async function markConversationAsRead(
  conversationId: string
): Promise<{ success: boolean; error?: string | null }> {
  await requireRole("employee");
  const supabase = await createClient();

  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function startNewConversation(
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string | null; conversationId?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get the instance
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", INSTANCE_NAME)
    .single();

  if (!instance) {
    return { success: false, error: "No hay instancia de WhatsApp configurada" };
  }

  try {
    // Send message first
    const result = await sendTextMessage(INSTANCE_NAME, phone, text);

    const remoteJid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;

    // Upsert conversation
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          instance_id: instance.id,
          remote_jid: remoteJid,
          contact_phone: phone.replace(/\D/g, ""),
          last_message_at: new Date().toISOString(),
          last_message_preview: text.substring(0, 100),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instance_id,remote_jid" }
      )
      .select("id")
      .single();

    if (!conversation) {
      return { success: false, error: "Error al crear conversación" };
    }

    // Save message
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      remote_jid: remoteJid,
      from_me: true,
      content: text,
      message_type: "text",
      whatsapp_message_id: result?.key?.id || null,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    return { success: true, error: null, conversationId: conversation.id };
  } catch (err) {
    console.error("[WhatsApp] New conversation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al enviar mensaje",
    };
  }
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("unread_count");

  if (!data) return 0;
  return data.reduce((sum, c) => sum + (c.unread_count || 0), 0);
}
