import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listFolderFiles,
  getOrCreateClientFolder,
  createProjectFolder,
} from "@/lib/google-drive/client";

/**
 * GET /api/drive/files?folderId=xxx
 *
 * Lists files inside a Google Drive folder.
 * Requires authenticated user.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderId = request.nextUrl.searchParams.get("folderId");
  if (!folderId) {
    return NextResponse.json(
      { error: "Missing folderId parameter" },
      { status: 400 },
    );
  }

  try {
    const files = await listFolderFiles(folderId);
    return NextResponse.json(files);
  } catch (err: unknown) {
    console.error("[Drive GET] Error listing files:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    // Surface Google API error details if available
    const details = (err as { errors?: unknown[] })?.errors;
    return NextResponse.json(
      { error: message, details: details ?? null },
      { status: 500 },
    );
  }
}

/**
 * POST /api/drive/files
 * Body: { projectId: string }
 *
 * Creates a Drive folder for a project that doesn't have one yet.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    return NextResponse.json(
      { error: "Google Drive not configured" },
      { status: 500 },
    );
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 },
    );
  }

  // Fetch project with client info
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_name, holded_contact_id, google_drive_folder_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.google_drive_folder_id) {
    return NextResponse.json(
      { error: "Project already has a Drive folder" },
      { status: 409 },
    );
  }

  const clientName = project.client_name ?? "Sin cliente";

  try {
    // Get or create client folder
    let clientFolderId: string;

    if (project.holded_contact_id) {
      const { data: existing } = await supabase
        .from("client_drive_folders")
        .select("drive_folder_id")
        .eq("holded_contact_id", project.holded_contact_id)
        .single();

      if (existing) {
        clientFolderId = existing.drive_folder_id;
      } else {
        clientFolderId = await getOrCreateClientFolder(clientName, parentFolderId);
        await supabase.from("client_drive_folders").insert({
          holded_contact_id: project.holded_contact_id,
          client_name: clientName,
          drive_folder_id: clientFolderId,
        });
      }
    } else {
      // No Holded contact — create a standalone client folder
      clientFolderId = await getOrCreateClientFolder(clientName, parentFolderId);
    }

    // Create project folder inside client folder
    const folderId = await createProjectFolder(project.name, clientFolderId);

    await supabase
      .from("projects")
      .update({ google_drive_folder_id: folderId })
      .eq("id", project.id);

    return NextResponse.json({ folderId });
  } catch (err: unknown) {
    console.error("[Drive POST] Error creating folder:", err);
    // Extract Google API error details
    let message = "Unknown error";
    let details: unknown = null;
    if (err instanceof Error) {
      message = err.message;
      // googleapis wraps errors with response data
      const gErr = err as { response?: { data?: { error?: { message?: string; errors?: unknown[] } } }; code?: number };
      if (gErr.response?.data?.error) {
        message = gErr.response.data.error.message ?? message;
        details = gErr.response.data.error.errors ?? null;
      }
    }
    return NextResponse.json({ error: message, details }, { status: 500 });
  }
}
