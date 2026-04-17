import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/google-drive/client";

function validatePin(request: NextRequest): boolean {
  const pin = request.headers.get("x-scan-pin");
  const expected = process.env.SCAN_PIN;
  if (!expected || !pin) return false;
  return pin === expected;
}

/**
 * POST /api/scan/upload
 * FormData: file + folderId
 * Header: x-scan-pin
 */
export async function POST(request: NextRequest) {
  if (!validatePin(request)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file || !folderId) {
      return NextResponse.json({ error: "Missing file or folderId" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadFile(
      folderId,
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );

    return NextResponse.json(driveFile);
  } catch (err) {
    console.error("[Scan Upload] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
