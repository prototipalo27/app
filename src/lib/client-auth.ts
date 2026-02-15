import { cookies } from "next/headers";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "client_session";

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Store a verification code in the DB. Returns the verification row ID.
 */
export async function createVerification(
  projectId: string,
  email: string,
  code: string,
): Promise<string> {
  const supabase = createServiceClient();

  // Delete any existing pending verifications for this project+email
  await supabase
    .from("client_verifications")
    .delete()
    .eq("project_id", projectId)
    .eq("email", email)
    .is("session_token", null);

  const { data, error } = await supabase
    .from("client_verifications")
    .insert({
      project_id: projectId,
      email,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Failed to create verification");
  return data.id;
}

/**
 * Check a code against the DB. If valid, creates a session_token,
 * sets the cookie, and returns the email. Returns null if invalid.
 */
export async function checkVerification(
  projectId: string,
  code: string,
): Promise<string | null> {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("client_verifications")
    .select("id, email, expires_at")
    .eq("project_id", projectId)
    .eq("code", code)
    .is("session_token", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) return null;

  // Generate session token and store it
  const sessionToken = crypto.randomUUID();
  await supabase
    .from("client_verifications")
    .update({
      session_token: sessionToken,
      verified_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return row.email;
}

/**
 * Get the verified session (projectId + email) from the session cookie.
 * Used by API routes to authenticate client requests.
 */
export async function getVerifiedSession(): Promise<{
  projectId: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("client_verifications")
    .select("project_id, email")
    .eq("session_token", sessionToken)
    .not("verified_at", "is", null)
    .limit(1)
    .single();

  if (!data) return null;
  return { projectId: data.project_id, email: data.email };
}

/**
 * Get the verified client email for a project from the session cookie.
 */
export async function getVerifiedClient(
  projectId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("client_verifications")
    .select("email")
    .eq("project_id", projectId)
    .eq("session_token", sessionToken)
    .not("verified_at", "is", null)
    .limit(1)
    .single();

  return data?.email ?? null;
}
