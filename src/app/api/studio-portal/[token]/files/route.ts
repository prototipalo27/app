import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { listFolderFiles } from "@/lib/google-drive/client";

/**
 * GET /api/studio-portal/[token]/files
 *
 * Lista archivos de la carpeta de Drive asociada al proyecto Studio del
 * colaborador identificado por `token`. Solo lectura — el portal no
 * permite subir.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: collaborator } = await supabase
    .from("studio_project_collaborators")
    .select("studio_project_id, can_see_documents")
    .eq("token", token)
    .single();

  if (!collaborator) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (!collaborator.can_see_documents) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: project } = await supabase
    .from("studio_projects")
    .select("google_drive_folder_id")
    .eq("id", collaborator.studio_project_id)
    .single();

  const folderId = project?.google_drive_folder_id;
  if (!folderId) {
    return NextResponse.json([]);
  }

  try {
    const files = await listFolderFiles(folderId);
    // No exponemos webViewLink/webContentLink — el portal descarga vía proxy.
    const safe = files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      thumbnailLink: f.thumbnailLink,
      size: f.size,
      modifiedTime: f.modifiedTime,
    }));
    return NextResponse.json(safe);
  } catch (err: unknown) {
    console.error("[studio-portal files] Error listing files:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
