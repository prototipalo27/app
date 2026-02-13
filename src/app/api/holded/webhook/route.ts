import { NextRequest, NextResponse } from "next/server";
import { syncHoldedDocuments } from "@/lib/holded/sync";

/**
 * POST /api/holded/webhook
 *
 * Endpoint for Holded webhooks. When a document is created/updated in Holded,
 * it triggers a full sync. Configure this URL in Holded → Settings → Webhooks.
 *
 * Optionally protected by HOLDED_WEBHOOK_SECRET query param.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.HOLDED_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret");
    if (token !== secret) {
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
