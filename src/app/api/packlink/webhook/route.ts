import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/packlink/webhook
 *
 * Receives tracking updates from Packlink webhooks.
 * No JWT auth — Packlink doesn't send tokens. Validates by matching reference.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { reference, status, tracking_code } = body as {
    reference?: string;
    status?: string;
    tracking_code?: string;
  };

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find shipping_info by Packlink reference
  const { data: shipping, error: findError } = await supabase
    .from("shipping_info")
    .select("id, project_id")
    .eq("packlink_shipment_ref", reference)
    .single();

  if (findError || !shipping) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  // Update shipping status
  const updates: Record<string, unknown> = {};
  if (status) updates.shipment_status = status;
  if (tracking_code) updates.tracking_number = tracking_code;

  if (status === "DELIVERED") {
    updates.delivered_at = new Date().toISOString();
    // Only update project status if linked to a project
    if (shipping.project_id) {
      await supabase
        .from("projects")
        .update({ status: "delivered" })
        .eq("id", shipping.project_id);
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("shipping_info")
      .update(updates)
      .eq("id", shipping.id);
  }

  return NextResponse.json({ ok: true });
}
