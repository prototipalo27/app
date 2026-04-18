/**
 * Resolves the email sending method for a user.
 *
 * Priority:
 * 1. google_accounts (OAuth — new path)
 * 2. user_smtp_settings (app passwords — legacy, deprecated)
 * 3. null (no sender configured — caller must handle with clear error)
 *
 * NEVER falls back to the global transporter (Manu's account).
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshAccessToken } from "@/lib/google-oauth";

export interface OAuthSender {
  type: "oauth";
  accessToken: string;
  fromEmail: string;
  displayName: string;
  signatureHtml?: string | null;
  userId: string;
}

export interface SmtpSender {
  type: "smtp";
  user: string;
  pass: string;
  fromEmail: string;
  displayName: string;
  signatureHtml?: string | null;
}

export type EmailSender = OAuthSender | SmtpSender;

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Get the email sender for a user. Returns null if no method is configured.
 * Handles token refresh automatically for OAuth accounts.
 */
export async function getUserEmailSender(userId: string): Promise<EmailSender | null> {
  const supabase = getServiceSupabase();

  // 1. Try OAuth (google_accounts) first
  const { data: oauth } = await supabase
    .from("google_accounts")
    .select("email, access_token_encrypted, refresh_token_encrypted, token_expires_at, last_error")
    .eq("user_id", userId)
    .maybeSingle();

  if (oauth) {
    try {
      let accessToken = decrypt(oauth.access_token_encrypted);
      const expiresAt = new Date(oauth.token_expires_at);

      // Refresh if expired or expiring within 5 minutes
      if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        const refreshToken = decrypt(oauth.refresh_token_encrypted);
        const refreshed = await refreshAccessToken(refreshToken);

        accessToken = refreshed.access_token;
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        // Update stored tokens
        await supabase
          .from("google_accounts")
          .update({
            access_token_encrypted: encrypt(accessToken),
            token_expires_at: newExpiresAt,
            last_error: null,
          })
          .eq("user_id", userId);
      }

      // Get display name from user_profiles, signature from user_smtp_settings (if exists)
      const [{ data: profile }, { data: smtpSettings }] = await Promise.all([
        supabase.from("user_profiles").select("full_name").eq("id", userId).maybeSingle(),
        supabase.from("user_smtp_settings").select("signature_html").eq("user_id", userId).maybeSingle(),
      ]);

      // Clear any previous error since we succeeded
      if (oauth.last_error) {
        await supabase
          .from("google_accounts")
          .update({ last_error: null })
          .eq("user_id", userId);
      }

      return {
        type: "oauth",
        accessToken,
        fromEmail: oauth.email,
        displayName: profile?.full_name || oauth.email,
        signatureHtml: smtpSettings?.signature_html || null,
        userId,
      };
    } catch (err) {
      // Token refresh failed — mark the error so the UI can show "reconnect"
      const message = err instanceof Error ? err.message : "Token refresh failed";
      console.error(`[EmailSender] OAuth token refresh failed for ${userId}:`, message);

      await supabase
        .from("google_accounts")
        .update({ last_error: message })
        .eq("user_id", userId);

      // Don't fall through to SMTP — return null so the caller shows a clear error
      return null;
    }
  }

  // 2. Fallback to legacy SMTP (user_smtp_settings)
  const { data: smtp } = await supabase
    .from("user_smtp_settings")
    .select("smtp_email, smtp_password_encrypted, display_name, signature_html")
    .eq("user_id", userId)
    .maybeSingle();

  if (smtp) {
    return {
      type: "smtp",
      user: smtp.smtp_email,
      pass: decrypt(smtp.smtp_password_encrypted),
      fromEmail: smtp.smtp_email,
      displayName: smtp.display_name,
      signatureHtml: smtp.signature_html,
    };
  }

  // 3. No sender configured
  return null;
}
