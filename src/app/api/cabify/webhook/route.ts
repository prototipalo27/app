import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CabifyWebhookPayload } from "@/lib/cabify/types";

/**
 * POST /api/cabify/webhook
 *
 * Receives status updates from Cabify and updates shipping_info.
 */
export async function POST(request: NextRequest) {
  // Optionally validate webhook secret
  const webhookSecret = process.env.CABIFY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-cabify-signature");
    if (signature !== webhookSecret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = (await request.json()) as CabifyWebhookPayload;
  const { parcel_id, status } = payload;

  if (!parcel_id || !status) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Use service role client for webhook (no user session)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const update: Record<string, unknown> = {
    shipment_status: status,
  };

  if (status === "delivered") {
    update.delivered_at = new Date().toISOString();
  }

  const { data: shipment, error: dbError } = await supabase
    .from("shipping_info")
    .update(update)
    .eq("cabify_parcel_id", parcel_id)
    .select("project_id")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // If delivered and linked to a project, update project status
  if (status === "delivered" && shipment?.project_id) {
    await supabase
      .from("projects")
      .update({ status: "delivered" })
      .eq("id", shipment.project_id);
  }

  return NextResponse.json({ ok: true });
}
