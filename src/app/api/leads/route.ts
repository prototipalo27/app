import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const source = typeof data.source === "string" ? data.source.slice(0, 80) : null;
  const honeypot = typeof data.company === "string" ? data.company : "";

  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("event_leads").insert({
    email,
    source,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    ip_hash: hashIp(req),
  });

  if (error && error.code !== "23505") {
    console.error("[api/leads] insert failed", error);
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
