import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/packlink/api";

/**
 * GET /api/packlink/shipments/[ref]/labels
 *
 * Fetches shipping label URLs from Packlink.
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
    const labels = await getLabels(ref);

    // Also save label URL to shipping_info
    if (labels.length > 0) {
      await supabase
        .from("shipping_info")
        .update({ label_url: labels[0].url })
        .eq("packlink_shipment_ref", ref);
    }

    return NextResponse.json(labels);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
