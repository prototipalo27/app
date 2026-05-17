import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";
import { listFolderFiles, downloadFile } from "@/lib/google-drive/client";

/**
 * Authenticated proxy for a Drive file that belongs to a lead's folder.
 * The CRM gallery hits this when displaying images that live in the lead's
 * Drive folder (post-qualification) or — once the folder has been promoted
 * to a project — in the linked project's folder.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string; fileId: string }> },
) {
  await requireRole("manager");

  const { leadId, fileId } = await params;
  const supabase = createServiceClient();

  // Resolve which Drive folder the file should live in: the lead's own
  // folder if it hasn't been promoted, otherwise the linked project's.
  const { data: lead } = await supabase
    .from("leads")
    .select("google_drive_folder_id")
    .eq("id", leadId)
    .single();

  let folderId = lead?.google_drive_folder_id ?? null;

  if (!folderId) {
    const { data: project } = await supabase
      .from("projects")
      .select("google_drive_folder_id")
      .eq("lead_id", leadId)
      .not("google_drive_folder_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    folderId = project?.google_drive_folder_id ?? null;
  }

  if (!folderId) {
    return NextResponse.json({ error: "Lead sin carpeta de Drive" }, { status: 404 });
  }

  const files = await listFolderFiles(folderId);
  if (!files.some((f) => f.id === fileId)) {
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
