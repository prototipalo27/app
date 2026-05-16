import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { listFolderFiles, downloadFile } from "@/lib/google-drive/client";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

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

  // Verify the file belongs to the project — either at the root or in any
  // legacy subfolder (Briefing/Diseño/Entregable).
  const rootFiles = await listFolderFiles(project.google_drive_folder_id);
  let belongs = rootFiles.some((f) => f.id === fileId);

  if (!belongs) {
    const subfolders = rootFiles.filter((f) => f.mimeType === FOLDER_MIME);
    for (const sub of subfolders) {
      try {
        const children = await listFolderFiles(sub.id);
        if (children.some((c) => c.id === fileId)) {
          belongs = true;
          break;
        }
      } catch (err) {
        console.error(`[track/photos] Failed to list subfolder ${sub.name}:`, err);
      }
    }
  }

  if (!belongs) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const { buffer, mimeType, name } = await downloadFile(fileId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
