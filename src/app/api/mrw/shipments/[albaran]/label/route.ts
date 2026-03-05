import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLabel } from "@/lib/mrw/api";

/**
 * GET /api/mrw/shipments/[albaran]/label
 *
 * Returns the PDF label for an MRW shipment.
 * Checks Supabase Storage first, falls back to MRW API.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albaran: string }> },
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albaran } = await params;

  // Try Supabase Storage first
  const filePath = `${albaran}.pdf`;
  const { data: fileData } = await supabase.storage
    .from("mrw-labels")
    .download(filePath);

  if (fileData) {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (buffer.length > 100) {
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="MRW-${albaran}.pdf"`,
        },
      });
    }
    await supabase.storage.from("mrw-labels").remove([filePath]);
  }

  // Fall back to MRW API
  try {
    const pdfBase64 = await getLabel(albaran);
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Save to storage for next time
    await supabase.storage
      .from("mrw-labels")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="MRW-${albaran}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
