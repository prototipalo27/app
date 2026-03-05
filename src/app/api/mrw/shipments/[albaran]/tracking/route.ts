import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTracking } from "@/lib/mrw/api";

/**
 * GET /api/mrw/shipments/[albaran]/tracking
 *
 * Returns tracking events for an MRW shipment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albaran: string }> },
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albaran } = await params;

  try {
    const events = await getTracking(albaran);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
