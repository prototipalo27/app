import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createParcel, shipParcels } from "@/lib/cabify/api";
import { CABIFY_SENDER } from "@/lib/cabify/sender";

/**
 * POST /api/cabify/shipments
 *
 * Creates a Cabify delivery and stores it in shipping_info.
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
    recipientName,
    recipientPhone,
    recipientEmail,
    street,
    city,
    postalCode,
    title,
    contentDescription,
    declaredValue,
  } = body as {
    projectId?: string;
    recipientName: string;
    recipientPhone?: string;
    recipientEmail?: string;
    street: string;
    city: string;
    postalCode: string;
    title?: string;
    contentDescription?: string;
    declaredValue?: number;
  };

  if (!street || !city || !postalCode) {
    return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
  }

  try {
    const parcel = await createParcel({
      pickup: CABIFY_SENDER,
      dropoff: {
        street,
        city,
        postal_code: postalCode,
        country: "ES",
        contact_name: recipientName,
        contact_phone: recipientPhone,
        contact_email: recipientEmail,
      },
      description: contentDescription || "3D printed parts",
    });

    // Ship the parcel (request pickup)
    await shipParcels([parcel.id]);

    const row: Record<string, unknown> = {
      cabify_parcel_id: parcel.id,
      carrier: "Cabify",
      shipment_status: "shipped",
      address_line: street,
      city,
      postal_code: postalCode,
      country: "ES",
      recipient_name: recipientName ?? null,
      recipient_phone: recipientPhone ?? null,
      recipient_email: recipientEmail ?? null,
      tracking_number: parcel.tracking_url ?? null,
      price: parcel.price?.amount ?? null,
      shipped_at: new Date().toISOString(),
      created_by: userData.user.id,
    };

    if (title) row.title = title;
    if (contentDescription) row.content_description = contentDescription;
    if (declaredValue != null) row.declared_value = declaredValue;

    if (projectId) {
      row.project_id = projectId;
      const { error: dbError } = await supabase
        .from("shipping_info")
        .upsert(row, { onConflict: "project_id" });

      if (dbError) {
        throw new Error(`DB error: ${dbError.message}`);
      }

      await supabase
        .from("projects")
        .update({ status: "shipping" })
        .eq("id", projectId);
    } else {
      const { error: dbError } = await supabase
        .from("shipping_info")
        .insert(row);

      if (dbError) {
        throw new Error(`DB error: ${dbError.message}`);
      }
    }

    return NextResponse.json({
      parcelId: parcel.id,
      trackingUrl: parcel.tracking_url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
