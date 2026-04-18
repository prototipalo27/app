import { NextRequest, NextResponse } from "next/server";
import { extractInvoiceData } from "@/lib/invoice-ocr";

function validateAuth(request: NextRequest): boolean {
  const pin = request.headers.get("x-scan-pin");
  const expectedPin = process.env.SCAN_PIN;
  if (pin && expectedPin && pin === expectedPin) return true;

  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  return hasAuthCookie;
}

/**
 * POST /api/scan/ocr
 * Body: FormData with "file" (image)
 * Returns: { company, total, date }
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ImageMediaType = typeof supportedTypes[number];

    if (!supportedTypes.includes(mimeType as ImageMediaType)) {
      return NextResponse.json({ company: null, total: null, date: null });
    }

    const result = await extractInvoiceData(base64, mimeType as ImageMediaType);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[OCR] Error:", err);
    return NextResponse.json({ company: null, total: null, date: null });
  }
}
