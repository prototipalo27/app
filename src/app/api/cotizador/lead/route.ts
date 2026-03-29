import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name, message, stlUrl } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "Email y nombre requeridos" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: name.trim(),
      email: email.trim(),
      message: message || null,
      source: "form",
      attachments: stlUrl || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[cotizador/lead] Insert failed:", error);
    return NextResponse.json({ error: "Error al crear lead" }, { status: 500 });
  }

  return NextResponse.json({ success: true, leadId: data.id });
}
