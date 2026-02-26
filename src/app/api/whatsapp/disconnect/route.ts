import { createClient } from "@/lib/supabase/server";
import { logoutInstance } from "@/lib/evolution-api";
import { NextResponse } from "next/server";

const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "prototipalo";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await logoutInstance(INSTANCE_NAME);

    // Update status in DB
    await supabase
      .from("whatsapp_instances")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("instance_name", INSTANCE_NAME);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[WhatsApp] Disconnect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al desconectar" },
      { status: 500 }
    );
  }
}
