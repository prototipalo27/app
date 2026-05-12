import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ remarkId: string; index: string }> },
) {
  const { remarkId, index } = await params;
  const i = Number.parseInt(index, 10);
  if (!Number.isFinite(i) || i < 0) {
    return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: remark } = await supabase
    .from("lead_remarks")
    .select("photo_paths")
    .eq("id", remarkId)
    .single();

  const path = remark?.photo_paths?.[i];
  if (!path) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const { data: file, error } = await supabase.storage
    .from("lead-remarks")
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
