import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncContactsToCache } from "@/lib/holded/cache";

/**
 * POST /api/holded/contacts/sync
 *
 * Forces a full resync of Holded contacts into the local cache.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await syncContactsToCache();
    return NextResponse.json({ success: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
