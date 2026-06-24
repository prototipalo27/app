import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistShipmentRow } from "@/lib/shipping/persist-shipment";
import { enqueueLabelPrint } from "@/lib/shipping/enqueue-print";
import { createShipment } from "@/lib/mrw/api";
import type { MrwShipmentParams } from "@/lib/mrw/types";
import { sendShippingNotification } from "@/lib/shipping-notification";

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
    addressExtra,
    title,
    contentDescription,
    declaredValue,
    packageWidth,
    packageHeight,
    packageLength,
    service,
    addressId,
    kind,
    autoPrint,
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
    addressExtra?: string;
    title?: string;
    contentDescription?: string;
    declaredValue?: number;
    packageWidth?: number;
    packageHeight?: number;
    packageLength?: number;
    service?: string;
    addressId?: string;
    kind?: "sample" | "partial" | "final";
    autoPrint?: boolean;
  };

  if (!recipientName || !recipientAddress || !recipientCity || !recipientPostalCode) {
    return NextResponse.json({ error: "Missing required recipient fields" }, { status: 400 });
  }

  // Tipo de envío: solo la entrega final mueve el estado del proyecto.
  const shipmentKind = kind === "sample" || kind === "partial" ? kind : "final";
  const isFinalDelivery = shipmentKind === "final";

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
    addressExtra,
    service: service || "0110",
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

    // Service code → human label for the audit trail.
    // Codes from SAGEC v4.5 manual.
    const serviceCode = mrwParams.service;
    const SERVICE_LABELS: Record<string, string> = {
      "0000": "MRW Urgente 10",
      "0100": "MRW Urgente 12",
      "0110": "MRW Urgente 14",
      "0200": "MRW Urgente 19",
      "0300": "MRW Económico",
      "0800": "MRW Ecommerce",
    };

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
      service_name: SERVICE_LABELS[serviceCode] ?? `MRW ${serviceCode}`,
      shipped_at: new Date().toISOString(),
      shipment_kind: shipmentKind,
      created_by: userData.user.id,
    };

    if (title) row.title = title;
    if (contentDescription) row.content_description = contentDescription;
    if (declaredValue != null) row.declared_value = declaredValue;
    if (addressId) row.address_id = addressId;
    if (projectId) row.project_id = projectId;

    // La entrega final reutiliza la fila 'final' del proyecto si ya existe
    // (p. ej. el placeholder de dirección creado en la proforma); así hay como
    // mucho UNA final por proyecto. Las pre-entregas siempre insertan fila nueva.
    const dbError = await persistShipmentRow(supabase, row, projectId, isFinalDelivery);

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    // Auto-imprimir: encola la etiqueta para que el agente local la imprima.
    // Activado por defecto; el cliente puede desactivarlo con autoPrint: false.
    if (labelUrl && autoPrint !== false) {
      const { data: created } = await supabase
        .from("shipping_info")
        .select("id")
        .eq("mrw_albaran", result.albaran)
        .limit(1)
        .maybeSingle();
      await enqueueLabelPrint(supabase, {
        labelUrl,
        shipmentId: created?.id ?? null,
        createdBy: userData.user.id,
      });
    }

    // Solo la entrega final mueve el proyecto a "shipping" y notifica al cliente.
    if (projectId && isFinalDelivery) {
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
          projectId,
          triggeredBy: userData.user.id,
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
