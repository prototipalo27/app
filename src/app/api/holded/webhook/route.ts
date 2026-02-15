import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncHoldedDocuments } from "@/lib/holded/sync";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * POST /api/holded/webhook
 *
 * Endpoint for Holded webhooks. When a document is created/updated in Holded,
 * it triggers a full sync. Configure this URL in Holded → Settings → Webhooks.
 *
 * Protected by HOLDED_WEBHOOK_SECRET via Authorization header or query param.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.HOLDED_WEBHOOK_SECRET;
  if (secret) {
    const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
    const queryToken = new URL(request.url).searchParams.get("secret");
    const token = bearer || queryToken || "";
    if (!token || !safeCompare(token, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncHoldedDocuments();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Holded webhook sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
