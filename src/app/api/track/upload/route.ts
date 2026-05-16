import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/google-drive/client";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("google_drive_folder_id")
    .eq("id", session.projectId)
    .single();

  if (!project?.google_drive_folder_id) {
    return NextResponse.json({ error: "Proyecto sin carpeta de Drive" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 50MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const driveFile = await uploadFile(
    project.google_drive_folder_id,
    file.name,
    file.type || "application/octet-stream",
    buffer,
  );

  return NextResponse.json({
    file: {
      id: driveFile.id,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      size: driveFile.size,
      modifiedTime: driveFile.modifiedTime,
    },
  });
}
