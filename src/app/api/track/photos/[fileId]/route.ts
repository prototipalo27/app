import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveSectionFolder, listFolderFiles, downloadFile } from "@/lib/google-drive/client";
import { cookies } from "next/headers";

const VALID_SECTIONS = ["briefing", "design", "deliverable"] as const;
type Section = (typeof VALID_SECTIONS)[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const section = (request.nextUrl.searchParams.get("section") as Section) ?? "deliverable";

  if (!VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: "Sección inválida" }, { status: 400 });
  }

  // Verify client cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("client_verified")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Token expirado" }, { status: 401 });
  }

  // Get project and check permissions
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("google_drive_folder_id, design_visible, deliverable_visible")
    .eq("id", payload.projectId)
    .single();

  if (!project?.google_drive_folder_id) {
    return NextResponse.json({ error: "Proyecto sin carpeta de Drive" }, { status: 404 });
  }

  if (section === "design" && !project.design_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }
  if (section === "deliverable" && !project.deliverable_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }

  // Resolve folder and verify file belongs to it
  const folderId = await resolveSectionFolder(project.google_drive_folder_id, section);
  if (!folderId) {
    return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
  }

  const folderFiles = await listFolderFiles(folderId);
  const fileInFolder = folderFiles.find((f) => f.id === fileId);

  if (!fileInFolder) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  // Download and proxy the file
  const { buffer, mimeType, name } = await downloadFile(fileId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
