import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail/client";

/**
 * GET /api/cron/invoice-watch
 *
 * Renews the Gmail push notification watch for manu@prototipalo.com
 * to monitor emails sent to administracion@prototipalo.com (invoices).
 * Called daily by Vercel Cron — the watch expires every 7 days.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = process.env.GOOGLE_PUBSUB_TOPIC_INVOICES || process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topic) {
    return NextResponse.json(
      { error: "No Pub/Sub topic configured for invoices" },
      { status: 500 },
    );
  }

  try {
    // Watch manu@'s Gmail via service account domain-wide delegation
    const gmail = getGmailClient("manu@prototipalo.com");

    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: topic,
        labelIds: ["INBOX"],
      },
    });

    // Store initial historyId if we don't have one
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: existing } = await supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "invoice_gmail_history_id")
      .single();

    if (!existing && res.data.historyId) {
      await supabase.from("app_metadata").upsert({
        key: "invoice_gmail_history_id",
        value: res.data.historyId,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      historyId: res.data.historyId,
      expiration: res.data.expiration,
    });
  } catch (err) {
    console.error("[invoice-watch] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
