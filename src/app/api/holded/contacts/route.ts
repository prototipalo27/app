import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listContacts, searchContacts } from "@/lib/holded/api";

/**
 * GET /api/holded/contacts?search=texto
 *
 * Server-side proxy to Holded API — keeps API key safe.
 * Requires authenticated user.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search");

  try {
    const contacts = search
      ? await searchContacts(search)
      : await listContacts();

    return NextResponse.json(contacts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
