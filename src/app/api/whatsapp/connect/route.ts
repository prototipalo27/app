import { createClient } from "@/lib/supabase/server";
import { getQRCode } from "@/lib/evolution-api";
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
    const result = await getQRCode(INSTANCE_NAME);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[WhatsApp] QR code error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener QR" },
      { status: 500 }
    );
  }
}
