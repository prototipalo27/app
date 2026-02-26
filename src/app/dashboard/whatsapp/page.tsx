import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import WhatsAppChat from "./whatsapp-chat";

export default async function WhatsAppPage() {
  await requireRole("manager");
  const supabase = await createClient();

  // Fetch recent conversations (only needed fields)
  const { data: conversations } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, contact_name, contact_phone, last_message_at, last_message_preview, unread_count, instance_id")
    .order("last_message_at", { ascending: false })
    .limit(100);

  // Fetch instance status
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .limit(1)
    .single();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          WhatsApp
        </h1>
        {instance && (
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                instance.status === "connected"
                  ? "bg-green-500"
                  : instance.status === "connecting"
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {instance.status === "connected"
                ? "Conectado"
                : instance.status === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
            </span>
          </div>
        )}
      </div>

      <WhatsAppChat
        initialConversations={conversations || []}
        instanceConnected={instance?.status === "connected"}
      />
    </div>
  );
}
