import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import {
  generateCode,
  createVerification,
  checkVerification,
} from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, token } = body as {
    action: "send" | "check";
    token: string;
    email?: string;
    code?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, client_email")
    .eq("tracking_token", token)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (action === "send") {
    const { email } = body as { email: string };
    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    if (
      !project.client_email ||
      project.client_email.toLowerCase() !== email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "El email no coincide con el del proyecto" },
        { status: 403 },
      );
    }

    // Rate limit: max 5 codes per project+email in 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("client_verifications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("email", email.toLowerCase())
      .gte("created_at", fifteenMinAgo);

    if (count !== null && count >= 5) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos antes de solicitar otro código." },
        { status: 429 },
      );
    }

    try {
      const code = generateCode();
      await createVerification(project.id, email, code);

      await sendEmail({
        to: email,
        subject: "Tu codigo de verificacion — Prototipalo",
        text: `Tu codigo de verificacion es: ${code}\n\nExpira en 10 minutos.`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #18181b; margin-bottom: 16px;">Prototipalo</h2>
            <p style="color: #52525b;">Tu codigo de verificacion es:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 0.15em; color: #18181b; text-align: center; margin: 24px 0;">${code}</p>
            <p style="color: #71717a; font-size: 14px;">Expira en 10 minutos.</p>
          </div>
        `,
      });

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Error in verification send:", err);
      const message = err instanceof Error ? err.message : "Error desconocido";
      return NextResponse.json(
        { error: `No se pudo enviar el código: ${message}` },
        { status: 500 },
      );
    }
  }

  if (action === "check") {
    const { code } = body as { code: string };
    if (!code) {
      return NextResponse.json({ error: "Codigo requerido" }, { status: 400 });
    }

    const email = await checkVerification(project.id, code);
    if (!email) {
      return NextResponse.json(
        { error: "Código incorrecto o expirado" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
}
