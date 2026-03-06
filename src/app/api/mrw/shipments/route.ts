import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShipment } from "@/lib/mrw/api";
import type { MrwShipmentParams } from "@/lib/mrw/types";
import { sendShippingNotification } from "@/lib/shipping-notification";
import { printLabel } from "@/lib/label-printer";

/**
 * POST /api/mrw/shipments
 *
 * Creates an MRW shipment and stores it in shipping_info.
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
    recipientAddress,
    recipientCity,
    recipientPostalCode,
    recipientCountry,
    recipientPhone,
    recipientEmail,
    packages,
    weight,
    reference,
    observations,
    title,
    contentDescription,
    declaredValue,
    packageWidth,
    packageHeight,
    packageLength,
    service,
    addressId,
  } = body as {
    projectId?: string;
    recipientName: string;
    recipientAddress: string;
    recipientCity: string;
    recipientPostalCode: string;
    recipientCountry?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    packages: number;
    weight: number;
    reference?: string;
    observations?: string;
    title?: string;
    contentDescription?: string;
    declaredValue?: number;
    packageWidth?: number;
    packageHeight?: number;
    packageLength?: number;
    service?: string;
    addressId?: string;
  };

  if (!recipientName || !recipientAddress || !recipientCity || !recipientPostalCode) {
    return NextResponse.json({ error: "Missing required recipient fields" }, { status: 400 });
  }

  const mrwParams: MrwShipmentParams = {
    recipientName,
    recipientAddress,
    recipientCity,
    recipientPostalCode,
    recipientCountry: recipientCountry || "ES",
    recipientPhone,
    recipientEmail,
    packages: packages || 1,
    weight: weight || 1,
    reference,
    observations,
    service: service || "0200",
  };

  try {
    const result = await createShipment(mrwParams);

    // Store label PDF in Supabase Storage
    let labelUrl: string | null = null;
    if (result.labelPdf) {
      const pdfBuffer = Buffer.from(result.labelPdf, "base64");
      const filePath = `${result.albaran}.pdf`;
      const { data: uploadData } = await supabase.storage
        .from("mrw-labels")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("mrw-labels")
          .getPublicUrl(filePath);
        labelUrl = urlData.publicUrl;
      }
    }

    // Print label automatically
    if (result.labelPdf) {
      printLabel(Buffer.from(result.labelPdf, "base64")).catch(() => {});
    }

    // Build DB row
    const row: Record<string, unknown> = {
      mrw_albaran: result.albaran,
      carrier: "MRW",
      shipment_status: "pending",
      address_line: recipientAddress,
      city: recipientCity,
      postal_code: recipientPostalCode,
      country: recipientCountry || "ES",
      recipient_name: recipientName,
      recipient_phone: recipientPhone ?? null,
      recipient_email: recipientEmail ?? null,
      package_width: packageWidth ?? null,
      package_height: packageHeight ?? null,
      package_length: packageLength ?? null,
      package_weight: weight ?? null,
      label_url: labelUrl,
      shipped_at: new Date().toISOString(),
      created_by: userData.user.id,
    };

    if (title) row.title = title;
    if (contentDescription) row.content_description = contentDescription;
    if (declaredValue != null) row.declared_value = declaredValue;
    if (addressId) row.address_id = addressId;
    if (projectId) row.project_id = projectId;

    const { error: dbError } = projectId
      ? await supabase
          .from("shipping_info")
          .upsert(row, { onConflict: "project_id" })
      : await supabase.from("shipping_info").insert(row);

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    if (projectId) {
      await supabase
        .from("projects")
        .update({ status: "shipping" })
        .eq("id", projectId);

      // Send shipping notification email to client
      const { data: proj } = await supabase
        .from("projects")
        .select("client_email, client_name, name, tracking_token")
        .eq("id", projectId)
        .single();

      if (proj?.client_email && proj.tracking_token) {
        sendShippingNotification({
          clientEmail: proj.client_email,
          clientName: proj.client_name,
          projectName: proj.name,
          carrier: "MRW",
          trackingNumber: result.albaran,
          trackingToken: proj.tracking_token,
        }).catch(() => {
          // Email failure should not break the shipment flow
        });
      }
    }

    return NextResponse.json({
      albaran: result.albaran,
      labelUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
