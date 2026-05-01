import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";

type ChecklistEntry = {
  photo_path?: string;
};

type ChecklistData = {
  entries?: ChecklistEntry[];
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string; index: string }> },
) {
  const { itemId, index } = await params;
  const entryIndex = Number.parseInt(index, 10);
  if (!Number.isFinite(entryIndex) || entryIndex < 0) {
    return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  }

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from("project_checklist_items")
    .select("project_id, data")
    .eq("id", itemId)
    .single();

  if (!item || item.project_id !== session.projectId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const entry = (item.data as ChecklistData | null)?.entries?.[entryIndex];
  if (!entry?.photo_path) {
    return NextResponse.json({ error: "Sin foto" }, { status: 404 });
  }

  const { data: file, error } = await supabase.storage
    .from("qc-photos")
    .download(entry.photo_path);
  if (error || !file) {
    return NextResponse.json(
      { error: error?.message ?? "No encontrado" },
      { status: 404 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
