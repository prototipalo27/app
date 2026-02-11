import { NextRequest, NextResponse } from "next/server";
import { syncHoldedDocuments } from "@/lib/holded/sync";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured → allow (dev)
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

/** GET /api/holded/sync — called by Vercel Cron */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncHoldedDocuments();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Holded sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/holded/sync — manual trigger */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncHoldedDocuments();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Holded sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
