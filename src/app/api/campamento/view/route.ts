import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

function hashIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// Registra una visita a la landing /campamento. Lo llama un beacon de cliente
// una vez por sesión, así que solo cuenta cargas reales de navegador.
export async function POST(req: NextRequest) {
  let referrer: string | null = null;
  try {
    const body = (await req.json()) as { referrer?: unknown };
    if (typeof body?.referrer === "string") referrer = body.referrer.slice(0, 300);
  } catch {
    // sin cuerpo: ok
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("camp_page_views").insert({
    ip_hash: hashIp(req),
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    referrer,
  });

  if (error) {
    console.error("[api/campamento/view] insert failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
