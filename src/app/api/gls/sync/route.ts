import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTracking } from "@/lib/gls/api";
import { sendPushToAll } from "@/lib/push-notifications/server";

/**
 * GET /api/gls/sync
 *
 * Cron job that polls all active GLS shipments for status updates.
 * Called by Vercel Cron every hour.
 *
 * GLS doesn't have webhooks, so we poll their tracking API
 * and detect delivery/status changes ourselves.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all GLS shipments that aren't delivered yet
  // gls_barcode exists in DB but not in generated types, so we select * and cast
  interface GlsShipmentRow {
    id: string;
    gls_barcode: string | null;
    shipment_status: string | null;
    project_id: string | null;
    recipient_name: string | null;
  }

  const { data, error } = await supabase
    .from("shipping_info")
    .select("*")
    .eq("carrier", "GLS")
    .neq("shipment_status", "delivered");

  const shipments = (data ?? []) as unknown as GlsShipmentRow[];

  if (error) {
    return NextResponse.json({ error: "Failed to fetch shipments" }, { status: 500 });
  }

  if (shipments.length === 0) {
    return NextResponse.json({ synced: 0, message: "No active GLS shipments" });
  }

  let updated = 0;
  let delivered = 0;

  for (const shipment of shipments) {
    const barcode = shipment.gls_barcode;
    if (!barcode) continue;

    try {
      const events = await getTracking(barcode);
      if (events.length === 0) continue;

      // Detect delivery: GLS uses keywords like "ENTREGADO", "ENTREGA EFECTUADA", "DELIVERED"
      const deliveryKeywords = ["ENTREGADO", "ENTREGA EFECTUADA", "DELIVERED", "ENTREGA REALIZADA"];
      const isDelivered = events.some((e) =>
        deliveryKeywords.some((kw) => e.description.toUpperCase().includes(kw))
      );

      // Detect in-transit: keywords like "EN TRANSITO", "EN REPARTO", "RECOGIDO"
      const transitKeywords = ["EN TRANSITO", "EN REPARTO", "RECOGIDO", "SALIDA", "LLEGADA", "IN TRANSIT"];
      const isInTransit = events.some((e) =>
        transitKeywords.some((kw) => e.description.toUpperCase().includes(kw))
      );

      // Determine new status
      let newStatus: string | null = null;
      if (isDelivered && shipment.shipment_status !== "delivered") {
        newStatus = "delivered";
      } else if (isInTransit && shipment.shipment_status === "pending") {
        newStatus = "in_transit";
      }

      if (!newStatus) continue;

      // Update shipping_info
      const updates: Record<string, unknown> = { shipment_status: newStatus };
      if (newStatus === "delivered") {
        updates.delivered_at = new Date().toISOString();
      }

      await supabase
        .from("shipping_info")
        .update(updates)
        .eq("id", shipment.id);

      updated++;

      // If delivered, also update the linked project
      if (newStatus === "delivered") {
        delivered++;

        if (shipment.project_id) {
          await supabase
            .from("projects")
            .update({ status: "delivered" })
            .eq("id", shipment.project_id);
        }

        // Send push notification
        sendPushToAll({
          title: "Paquete entregado",
          body: `GLS ${barcode} entregado${shipment.recipient_name ? ` a ${shipment.recipient_name}` : ""}`,
          url: "/dashboard/shipments",
        }).catch(() => {});
      } else if (newStatus === "in_transit") {
        sendPushToAll({
          title: "Paquete en reparto",
          body: `GLS ${barcode}${shipment.recipient_name ? ` para ${shipment.recipient_name}` : ""}`,
          url: "/dashboard/shipments",
        }).catch(() => {});
      }
    } catch {
      // Skip shipments that fail to fetch tracking (e.g. GLS API down)
      continue;
    }
  }

  return NextResponse.json({
    synced: shipments.length,
    updated,
    delivered,
  });
}
