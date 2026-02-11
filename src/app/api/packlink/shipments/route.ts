import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/packlink/api";
import type { PacklinkAddress, PacklinkPackage } from "@/lib/packlink/types";

/**
 * POST /api/packlink/shipments
 *
 * Creates a shipping order in Packlink and stores the reference in shipping_info.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    projectId,
    serviceId,
    serviceName,
    from,
    to,
    packages,
    content,
    contentvalue,
  } = body as {
    projectId: string;
    serviceId: number;
    serviceName: string;
    from: PacklinkAddress;
    to: PacklinkAddress;
    packages: PacklinkPackage[];
    content: string;
    contentvalue: number;
  };

  if (!projectId || !serviceId || !from || !to || !packages?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await createOrder({
      from,
      to,
      packages,
      service_id: serviceId,
      content: content || "3D printed parts",
      contentvalue: contentvalue || 0,
      source: "prototipalo",
    });

    const pkg = packages[0];

    // Upsert shipping_info row
    const { error: dbError } = await supabase
      .from("shipping_info")
      .upsert(
        {
          project_id: projectId,
          packlink_shipment_ref: result.reference,
          service_id: serviceId,
          service_name: serviceName,
          carrier: serviceName,
          shipment_status: "pending",
          address_line: to.street1,
          city: to.city,
          postal_code: to.zip_code,
          country: to.country,
          recipient_name: to.name ?? null,
          recipient_phone: to.phone ?? null,
          recipient_email: to.email ?? null,
          package_width: pkg.width,
          package_height: pkg.height,
          package_length: pkg.length,
          package_weight: pkg.weight,
          shipped_at: new Date().toISOString(),
        },
        { onConflict: "project_id" },
      );

    if (dbError) {
      throw new Error(`DB error: ${dbError.message}`);
    }

    // Update project status to "shipping"
    await supabase
      .from("projects")
      .update({ status: "shipping" })
      .eq("id", projectId);

    return NextResponse.json({ reference: result.reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
