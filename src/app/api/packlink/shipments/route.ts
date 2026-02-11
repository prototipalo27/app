import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/packlink/api";
import type { PacklinkAddress, PacklinkPackage } from "@/lib/packlink/types";

/**
 * POST /api/packlink/shipments
 *
 * Creates a shipping order in Packlink and stores the reference in shipping_info.
 * projectId is optional — when omitted, creates a standalone shipment.
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
    title,
    contentDescription,
    declaredValue,
  } = body as {
    projectId?: string;
    serviceId: number;
    serviceName: string;
    from: PacklinkAddress;
    to: PacklinkAddress;
    packages: PacklinkPackage[];
    content: string;
    contentvalue: number;
    title?: string;
    contentDescription?: string;
    declaredValue?: number;
  };

  if (!serviceId || !from || !to || !packages?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await createOrder({
      from,
      to,
      packages,
      service_id: serviceId,
      content: content || contentDescription || "3D printed parts",
      contentvalue: contentvalue || declaredValue || 0,
      source: "prototipalo",
    });

    const pkg = packages[0];

    const row: Record<string, unknown> = {
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
      created_by: userData.user.id,
    };

    if (title) row.title = title;
    if (contentDescription) row.content_description = contentDescription;
    if (declaredValue != null) row.declared_value = declaredValue;

    if (projectId) {
      // Linked to a project — upsert with onConflict
      row.project_id = projectId;
      const { error: dbError } = await supabase
        .from("shipping_info")
        .upsert(row, { onConflict: "project_id" });

      if (dbError) {
        throw new Error(`DB error: ${dbError.message}`);
      }

      // Update project status to "shipping"
      await supabase
        .from("projects")
        .update({ status: "shipping" })
        .eq("id", projectId);
    } else {
      // Standalone shipment — plain insert
      const { error: dbError } = await supabase
        .from("shipping_info")
        .insert(row);

      if (dbError) {
        throw new Error(`DB error: ${dbError.message}`);
      }
    }

    return NextResponse.json({ reference: result.reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
