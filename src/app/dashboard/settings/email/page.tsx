import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import EmailSettingsForm from "./email-settings-form";
import GoogleAccountCard from "./google-account-card";

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const profile = await requireRole("comercial");
  const supabase = await createClient();
  const params = await searchParams;

  // Fetch Google OAuth account (use service role to read encrypted tokens metadata)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: googleAccount } = await serviceSupabase
    .from("google_accounts")
    .select("email, connected_at, last_used_at, last_error, scopes")
    .eq("user_id", profile.id)
    .maybeSingle();

  // Fetch legacy SMTP settings
  const { data: smtpSettings } = await supabase
    .from("user_smtp_settings")
    .select("smtp_email, display_name, signature_html")
    .eq("user_id", profile.id)
    .maybeSingle();

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
          Conecta tu cuenta de Google para enviar emails desde el CRM con tu
          propio remitente.
        </p>
      </div>

      {/* Success/error messages from OAuth redirect */}
      {params.connected && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cuenta de Google conectada correctamente.
        </div>
      )}
      {params.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {params.error}
        </div>
      )}

      {/* Google OAuth block (primary) */}
      <GoogleAccountCard googleAccount={googleAccount} />

      {/* Legacy SMTP block (deprecated, collapsed) */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
          Metodo antiguo (contrasena de aplicacion)
        </summary>
        <div className="mt-3">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            Este metodo sera retirado. Conecta tu cuenta de Google arriba para un metodo mas seguro y fiable.
          </div>
          {smtpSettings ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Configurado: {smtpSettings.smtp_email}
            </div>
          ) : null}
          <EmailSettingsForm
            defaultValues={smtpSettings ? {
              smtp_email: smtpSettings.smtp_email,
              display_name: smtpSettings.display_name,
              signature_html: smtpSettings.signature_html || "",
            } : undefined}
          />
        </div>
      </details>
    </div>
  );
}
