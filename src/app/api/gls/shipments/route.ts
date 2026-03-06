import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShipment } from "@/lib/gls/api";
import type { GlsShipmentParams } from "@/lib/gls/types";
import { sendShippingNotification } from "@/lib/shipping-notification";

// Map ISO country codes to GLS numeric codes
const COUNTRY_MAP: Record<string, string> = {
  ES: "34",
  PT: "351",
  FR: "33",
  DE: "49",
  IT: "39",
  GB: "44",
  NL: "31",
  BE: "32",
  AT: "43",
  CH: "41",
  IE: "353",
  PL: "48",
  CZ: "420",
  DK: "45",
  SE: "46",
  NO: "47",
  FI: "358",
};

/**
 * POST /api/gls/shipments
 *
 * Creates a GLS shipment and stores it in shipping_info.
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
    horario,
    addressId,
  } = body as {
    projectId?: string;
    recipientName: string;
    recipientAddress: string;
    recipientCity: string;
    recipientPostalCode: string;
    recipientCountry: string; // ISO code like "ES"
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
    horario?: string;
    addressId?: string;
  };

  if (!recipientName || !recipientAddress || !recipientCity || !recipientPostalCode || !recipientCountry) {
    return NextResponse.json({ error: "Missing required recipient fields" }, { status: 400 });
  }

  // Convert ISO country code to GLS numeric code
  const glsCountry = COUNTRY_MAP[recipientCountry] || recipientCountry;

  const glsParams: GlsShipmentParams = {
    recipientName,
    recipientAddress,
    recipientCity,
    recipientPostalCode,
    recipientCountry: glsCountry,
    recipientPhone,
    recipientEmail,
    packages: packages || 1,
    weight: weight || 1,
    reference,
    observations,
    horario,
  };

  try {
    const result = await createShipment(glsParams);

    // Store label PDF in Supabase Storage
    let labelUrl: string | null = null;
    if (result.labelPdf) {
      const pdfBuffer = Buffer.from(result.labelPdf, "base64");
      const filePath = `${result.barcode}.pdf`;
      const { data: uploadData } = await supabase.storage
        .from("gls-labels")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("gls-labels")
          .getPublicUrl(filePath);
        labelUrl = urlData.publicUrl;
      }
    }

    // Build DB row
    const row: Record<string, unknown> = {
      gls_barcode: result.barcode,
      carrier: "GLS",
      shipment_status: "pending",
      address_line: recipientAddress,
      city: recipientCity,
      postal_code: recipientPostalCode,
      country: recipientCountry,
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
          carrier: "GLS",
          trackingNumber: result.barcode,
          trackingToken: proj.tracking_token,
        }).catch(() => {
          // Email failure should not break the shipment flow
        });
      }
    }

    return NextResponse.json({
      barcode: result.barcode,
      labelUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
