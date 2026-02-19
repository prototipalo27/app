import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLabel } from "@/lib/gls/api";

/**
 * GET /api/gls/shipments/[barcode]/label
 *
 * Returns the PDF label for a GLS shipment.
 * First checks Supabase Storage, then falls back to GLS API.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barcode } = await params;

  // Try to get from Supabase Storage first
  const filePath = `${barcode}.pdf`;
  const { data: fileData } = await supabase.storage
    .from("gls-labels")
    .download(filePath);

  if (fileData) {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="GLS-${barcode}.pdf"`,
      },
    });
  }

  // Fall back to GLS API
  try {
    const pdfBase64 = await getLabel(barcode);
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Save to storage for next time
    await supabase.storage
      .from("gls-labels")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="GLS-${barcode}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
