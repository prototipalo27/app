import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTracking } from "@/lib/packlink/api";

/**
 * GET /api/packlink/shipments/[ref]/tracking
 *
 * Fetches tracking events from Packlink.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tracking = await getTracking(ref);
    return NextResponse.json(tracking);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
