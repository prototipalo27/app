import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  downloadFile,
  getFileParents,
  listFolderFiles,
} from "@/lib/google-drive/client";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * GET /api/studio-portal/[token]/files/[fileId]
 *
 * Proxy de descarga para el portal del colaborador. Verifica que:
 *  - El token es válido y `can_see_documents` está activo.
 *  - El fileId vive dentro de la carpeta raíz del proyecto Studio o en
 *    alguna de sus subcarpetas inmediatas (Brief, Patentes, etc.).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; fileId: string }> },
) {
  const { token, fileId } = await params;
  if (!token || !fileId) {
    return NextResponse.json(
      { error: "Missing token or fileId" },
      { status: 400 },
    );
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

  const rootFolderId = project?.google_drive_folder_id;
  if (!rootFolderId) {
    return NextResponse.json({ error: "No folder" }, { status: 404 });
  }

  try {
    // Construye el set de carpetas válidas: raíz + subcarpetas inmediatas.
    const rootChildren = await listFolderFiles(rootFolderId);
    const allowed = new Set<string>([rootFolderId]);
    for (const child of rootChildren) {
      if (child.mimeType === FOLDER_MIME) allowed.add(child.id);
    }

    const parents = await getFileParents(fileId);
    if (!parents.some((p) => allowed.has(p))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { buffer, mimeType, name } = await downloadFile(fileId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    console.error("[studio-portal download] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
