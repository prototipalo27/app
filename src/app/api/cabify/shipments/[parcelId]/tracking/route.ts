import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParcelStatus } from "@/lib/cabify/api";

/**
 * GET /api/cabify/shipments/[parcelId]/tracking
 *
 * Returns tracking events for a Cabify delivery.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ parcelId: string }> },
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { parcelId } = await params;

  try {
    const status = await getParcelStatus(parcelId);
    return NextResponse.json({
      status: status.status,
      events: status.events,
      tracking_url: status.tracking_url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
