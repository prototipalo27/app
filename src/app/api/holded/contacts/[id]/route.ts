import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/holded/api";

/**
 * GET /api/holded/contacts/[id]
 *
 * Server-side proxy to fetch a single Holded contact by ID.
 * Requires authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const contact = await getContact(id);
    return NextResponse.json(contact);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
