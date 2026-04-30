import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: item } = await supabase
    .from("project_checklist_items")
    .select("data")
    .eq("id", itemId)
    .single();

  const path = (item?.data as { photo_path?: string } | null)?.photo_path;
  if (!path) {
    return NextResponse.json({ error: "Sin foto" }, { status: 404 });
  }

  const { data: file, error } = await supabase.storage
    .from("qc-photos")
    .download(path);
  if (error || !file) {
    return NextResponse.json({ error: error?.message ?? "No encontrado" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
