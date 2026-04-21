import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTracking } from "@/lib/mrw/api";
import { deriveMrwStatus } from "@/lib/mrw/status";

/**
 * GET /api/mrw/shipments/[albaran]/tracking
 *
 * Returns tracking events for an MRW shipment and opportunistically syncs
 * shipment_status / delivered_at on shipping_info if MRW reports a change.
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
    const derived = deriveMrwStatus(events);

    const { data: shipment } = await supabase
      .from("shipping_info")
      .select("id, shipment_status, delivered_at")
      .eq("mrw_albaran", albaran)
      .maybeSingle();

    if (shipment) {
      const updates: { shipment_status?: string; delivered_at?: string } = {};
      if (derived.status !== shipment.shipment_status) updates.shipment_status = derived.status;
      if (derived.deliveredAt && !shipment.delivered_at) updates.delivered_at = derived.deliveredAt;
      if (Object.keys(updates).length > 0) {
        await supabase.from("shipping_info").update(updates).eq("id", shipment.id);
      }
    }

    return NextResponse.json({ events, status: derived.status, deliveredAt: derived.deliveredAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("MRW tracking fetch failed", { albaran, err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
