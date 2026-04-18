import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeToken } from "@/lib/google-oauth";
import { decrypt } from "@/lib/encryption";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/google/disconnect
 *
 * Revokes Google tokens and removes the google_accounts row.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    // Fetch current tokens to revoke them at Google
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: account } = await serviceSupabase
      .from("google_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (account) {
      // Revoke refresh token at Google (best-effort)
      try {
        const refreshToken = decrypt(account.refresh_token_encrypted);
        await revokeToken(refreshToken);
      } catch {
        // Token may already be revoked — continue with deletion
      }

      // Delete the row
      const { error: deleteError } = await serviceSupabase
        .from("google_accounts")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Google OAuth] Disconnect error:", err);
    return NextResponse.json({ error: "Error al desconectar" }, { status: 500 });
  }
}
