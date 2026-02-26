import { createClient } from "@/lib/supabase/server";
import { createInstance } from "@/lib/evolution-api";
import { NextResponse } from "next/server";

const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "prototipalo";

export async function POST() {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/webhooks/whatsapp`;

    const result = await createInstance(INSTANCE_NAME, webhookUrl);

    // Save instance to DB
    await supabase.from("whatsapp_instances").upsert(
      {
        instance_name: INSTANCE_NAME,
        status: "disconnected",
        api_key: result?.hash || null,
      },
      { onConflict: "instance_name" }
    );

    return NextResponse.json({ success: true, instance: result });
  } catch (err) {
    console.error("[WhatsApp] Create instance error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear instancia" },
      { status: 500 }
    );
  }
}
