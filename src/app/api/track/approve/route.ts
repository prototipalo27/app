import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
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
    .eq("id", payload.projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (section === "design") {
    if (!project.design_visible) {
      return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
    }
    if (project.design_approved_at) {
      return NextResponse.json({ error: "Ya aprobado" }, { status: 409 });
    }

    await supabase
      .from("projects")
      .update({ design_approved_at: now })
      .eq("id", payload.projectId);

    return NextResponse.json({ ok: true, approved_at: now });
  }

  // deliverable
  if (!project.deliverable_visible) {
    return NextResponse.json({ error: "Sección no disponible" }, { status: 403 });
  }
  if (project.deliverable_approved_at) {
    return NextResponse.json({ error: "Ya aprobado" }, { status: 409 });
  }

  const update: Record<string, string> = { deliverable_approved_at: now };
  if (confirmPayment) {
    update.payment_confirmed_at = now;
  }

  await supabase
    .from("projects")
    .update(update)
    .eq("id", payload.projectId);

  return NextResponse.json({ ok: true, approved_at: now });
}
