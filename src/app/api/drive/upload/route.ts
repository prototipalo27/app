import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/google-drive/client";

/**
 * POST /api/drive/upload
 *
 * Accepts multipart/form-data with:
 *   - file: the binary file
 *   - folderId: the target Drive folder ID
 *
 * Returns the created DriveFile object.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file || !folderId) {
      return NextResponse.json(
        { error: "Missing file or folderId" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadFile(
      folderId,
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );

    return NextResponse.json(driveFile);
  } catch (err: unknown) {
    console.error("[Drive Upload] Error uploading file:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const details = (err as { errors?: unknown[] })?.errors;
    return NextResponse.json(
      { error: message, details: details ?? null },
      { status: 500 },
    );
  }
}
