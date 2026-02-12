import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { to, subject, text, html } = body;

  if (!to || !subject || !text) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: to, subject, text" },
      { status: 400 }
    );
  }

  try {
    const result = await sendEmail({ to, subject, text, html });
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Error enviando email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error enviando email" },
      { status: 500 }
    );
  }
}
