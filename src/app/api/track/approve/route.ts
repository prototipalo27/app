import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { section, confirmPayment } = body as {
    section: "design" | "deliverable";
    confirmPayment?: boolean;
  };

  if (section !== "design" && section !== "deliverable") {
    return NextResponse.json({ error: "Sección inválida" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("design_visible, design_approved_at, deliverable_visible, deliverable_approved_at, payment_confirmed_at")
    .eq("id", session.projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (section === "design") {
    if (!project.design_visible) {
      return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
    }

    await supabase
      .from("projects")
      .update({ design_approved_at: now })
      .eq("id", session.projectId);

    return NextResponse.json({ ok: true, approved_at: now });
  }

  // deliverable
  if (!project.deliverable_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }

  const update: Record<string, string> = { deliverable_approved_at: now };
  if (confirmPayment) {
    update.payment_confirmed_at = now;
  }

  await supabase
    .from("projects")
    .update(update)
    .eq("id", session.projectId);

  return NextResponse.json({ ok: true, approved_at: now });
}
