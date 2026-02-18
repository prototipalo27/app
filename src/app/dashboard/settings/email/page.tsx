import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import EmailSettingsForm from "./email-settings-form";

export default async function EmailSettingsPage() {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("user_smtp_settings")
    .select("smtp_email, display_name, signature_html")
    .eq("user_id", profile.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/crm"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a CRM
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Mi cuenta de email
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configura tu cuenta de Gmail para enviar emails desde el CRM con tu
          propio remitente y firma.
        </p>
      </div>

      {settings ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Configurado: {settings.smtp_email}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No configurado — los emails se envían desde la cuenta global de Prototipalo.
        </div>
      )}

      <EmailSettingsForm
        defaultValues={settings ? {
          smtp_email: settings.smtp_email,
          display_name: settings.display_name,
          signature_html: settings.signature_html || "",
        } : undefined}
      />
    </div>
  );
}
