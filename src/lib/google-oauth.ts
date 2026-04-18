/**
 * Google OAuth 2.0 helpers for Gmail API integration.
 *
 * Uses our own token management (NOT Supabase's provider_token) so we can:
 * - Guarantee refresh_token persistence
 * - Add scopes incrementally (Fase 1: gmail.readonly)
 * - Control the token lifecycle independently of Supabase Auth
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Scopes for Fase 0: send-only. Fase 1 will add gmail.readonly incrementally. */
const SCOPES_FASE_0 = ["https://www.googleapis.com/auth/gmail.send"];

function getClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET not set");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!uri) throw new Error("GOOGLE_OAUTH_REDIRECT_URI not set");
  return uri;
}

/**
 * Build the Google OAuth consent URL.
 * login_hint pre-fills the account selector with the user's email.
 */
export function buildAuthUrl(loginHint: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES_FASE_0.join(" "),
    access_type: "offline",
    prompt: "consent", // Forces refresh_token on first connect
    login_hint: loginHint,
    include_granted_scopes: "true", // Incremental scopes for Fase 1+
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
}

/** Exchange authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token exchange failed: ${err.error_description || err.error}`);
  }

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error("No refresh_token received. Try revoking access at myaccount.google.com/permissions and reconnecting.");
  }
  return data as GoogleTokens;
}

/** Get the email address associated with the access token. */
export async function getTokenEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get user info from Google");
  const data = await res.json();
  return data.email as string;
}

export interface RefreshedTokens {
  access_token: string;
  expires_in: number;
  scope: string;
}

/** Refresh an expired access token using the refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${err.error_description || err.error}`);
  }

  return (await res.json()) as RefreshedTokens;
}

/** Revoke a token (access or refresh) so Google invalidates it. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  // Best-effort: don't throw if revoke fails (token may already be invalid)
}
