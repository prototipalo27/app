import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveSectionFolder, listFolderFiles } from "@/lib/google-drive/client";

const VALID_SECTIONS = ["briefing", "design", "deliverable"] as const;
type Section = (typeof VALID_SECTIONS)[number];

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") as Section | null;
  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: "Sección inválida" }, { status: 400 });
  }

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("google_drive_folder_id, design_visible, deliverable_visible")
    .eq("id", session.projectId)
    .single();

  if (!project?.google_drive_folder_id) {
    return NextResponse.json({ error: "Proyecto sin carpeta de Drive" }, { status: 404 });
  }

  // Check section permissions
  if (section === "design" && !project.design_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }
  if (section === "deliverable" && !project.deliverable_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }

  const folderId = await resolveSectionFolder(project.google_drive_folder_id, section);
  if (!folderId) {
    return NextResponse.json({ files: [] });
  }

  const files = await listFolderFiles(folderId);
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const filtered = files
    .filter((f) => f.mimeType !== FOLDER_MIME)
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      modifiedTime: f.modifiedTime,
    }));

  return NextResponse.json({ files: filtered });
}
