import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import WhatsAppSettings from "./whatsapp-settings";

export default async function WhatsAppSettingsPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .limit(1)
    .single();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Configuración WhatsApp
      </h1>
      <WhatsAppSettings instance={instance} />
    </div>
  );
}
