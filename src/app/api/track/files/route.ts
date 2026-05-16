import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { listFolderFiles } from "@/lib/google-drive/client";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Lists every file in the project's Drive folder, recursively flattening any
 * legacy subfolders (Briefing/Diseño/Entregable) so the client sees a single
 * unified list regardless of when the project was created.
 */
export async function GET() {
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

  const rootFiles = await listFolderFiles(project.google_drive_folder_id);
  const subfolders = rootFiles.filter((f) => f.mimeType === FOLDER_MIME);
  const collected = rootFiles.filter((f) => f.mimeType !== FOLDER_MIME);

  // Pull files out of legacy subfolders too (Briefing/Diseño/Entregable).
  for (const sub of subfolders) {
    try {
      const children = await listFolderFiles(sub.id);
      for (const child of children) {
        if (child.mimeType !== FOLDER_MIME) collected.push(child);
      }
    } catch (err) {
      console.error(`[track/files] Failed to list subfolder ${sub.name}:`, err);
    }
  }

  const files = collected.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
  }));

  return NextResponse.json({ files });
}
