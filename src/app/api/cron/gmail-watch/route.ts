import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail/client";

/**
 * GET /api/cron/gmail-watch
 *
 * Renews the Gmail push notification watch.
 * Called daily by Vercel Cron — the watch expires every 7 days.
 *
 * Required env vars:
 *   GOOGLE_PUBSUB_TOPIC — e.g. "projects/theapp-487115/topics/gmail-push"
 *   CRON_SECRET — shared secret for cron auth
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topic) {
    return NextResponse.json(
      { error: "GOOGLE_PUBSUB_TOPIC not configured" },
      { status: 500 },
    );
  }

  try {
    const gmail = getGmailClient();

    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: topic,
        labelIds: ["INBOX"],
      },
    });

    // Store the initial historyId if we don't have one yet
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: existing } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", "gmail_history_id")
      .single();

    if (!existing && res.data.historyId) {
      await supabase.from("app_state").upsert({
        key: "gmail_history_id",
        value: res.data.historyId,
        updated_at: new Date().toISOString(),
      });
    }

    console.log("[gmail-watch] Watch renewed, expiration:", res.data.expiration);

    return NextResponse.json({
      ok: true,
      historyId: res.data.historyId,
      expiration: res.data.expiration,
    });
  } catch (err) {
    console.error("[gmail-watch] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
