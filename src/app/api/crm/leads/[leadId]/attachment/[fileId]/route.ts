import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";
import {
  listFolderFiles,
  downloadFile,
  downloadThumbnail,
} from "@/lib/google-drive/client";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

function guessMimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

/**
 * Authenticated proxy for a Drive file that belongs to a lead's folder.
 * The CRM gallery hits this when displaying images that live in the lead's
 * Drive folder (post-qualification) or — once the folder has been promoted
 * to a project — in the linked project's folder.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string; fileId: string }> },
) {
  await requireRole("manager");

  const { leadId, fileId } = await params;
  const wantsThumb = new URL(request.url).searchParams.get("thumb") === "1";
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

  if (wantsThumb) {
    const thumb = await downloadThumbnail(fileId, 400);
    if (!thumb) {
      return NextResponse.json({ error: "Sin thumbnail" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(thumb.buffer), {
      headers: {
        "Content-Type": thumb.mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  const { buffer, mimeType, name } = await downloadFile(fileId);

  // Drive sometimes stores octet-stream for files we uploaded before we
  // started inferring the MIME from the filename; override here so <img>
  // and PDF iframes render properly regardless.
  const finalMime =
    mimeType && mimeType !== "application/octet-stream"
      ? mimeType
      : (guessMimeFromName(name) ?? mimeType);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": finalMime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
