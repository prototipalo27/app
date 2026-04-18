import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getTokenEmail } from "@/lib/google-oauth";
import { encrypt } from "@/lib/encryption";
import { cookies } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.prototipalo.es";
const SETTINGS_URL = `${APP_URL}/dashboard/settings/email`;

/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth redirect from Google. Validates state, exchanges code
 * for tokens, validates email match, and stores encrypted tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied consent
  if (error) {
    return NextResponse.redirect(`${SETTINGS_URL}?error=${encodeURIComponent("Conexión cancelada")}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${SETTINGS_URL}?error=${encodeURIComponent("Faltan parámetros de OAuth")}`);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${SETTINGS_URL}?error=${encodeURIComponent("Estado de OAuth inválido. Intenta de nuevo.")}`);
  }

  // Verify user is logged in
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get the email from the token to validate it matches the logged-in user
    const tokenEmail = await getTokenEmail(tokens.access_token);

    if (tokenEmail.toLowerCase() !== user.email!.toLowerCase()) {
      return NextResponse.redirect(
        `${SETTINGS_URL}?error=${encodeURIComponent(
          `Conecta la misma cuenta con la que iniciaste sesión (${user.email}). Has intentado conectar ${tokenEmail}.`
        )}`
      );
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Parse scopes from response
    const scopes = tokens.scope.split(" ").filter(Boolean);

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);

    // Upsert into google_accounts (use service role for upsert reliability)
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error: dbError } = await serviceSupabase
      .from("google_accounts")
      .upsert({
        user_id: user.id,
        email: tokenEmail,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        scopes,
        connected_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("[Google OAuth] DB error:", dbError);
      return NextResponse.redirect(
        `${SETTINGS_URL}?error=${encodeURIComponent("Error al guardar la conexión. Intenta de nuevo.")}`
      );
    }

    return NextResponse.redirect(`${SETTINGS_URL}?connected=true`);
  } catch (err) {
    console.error("[Google OAuth] Callback error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.redirect(`${SETTINGS_URL}?error=${encodeURIComponent(message)}`);
  }
}
