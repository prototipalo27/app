import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_DOMAIN = "prototipalo.com";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email ?? "";

      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=Solo cuentas @${ALLOWED_DOMAIN} pueden acceder`,
        );
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
