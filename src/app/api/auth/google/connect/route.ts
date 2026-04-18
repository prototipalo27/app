import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-oauth";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

/**
 * GET /api/auth/google/connect
 *
 * Initiates OAuth flow to connect user's Google account for Gmail sending.
 * Requires an active Supabase session.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://app.prototipalo.es"));
  }

  // Generate CSRF state token and store in cookie
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authUrl = buildAuthUrl(user.email!, state);
  return NextResponse.redirect(authUrl);
}
