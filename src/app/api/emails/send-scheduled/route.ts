import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, deserializeEmailPayload } from "@/lib/email";

/**
 * GET /api/emails/send-scheduled
 *
 * Dispatches all pending scheduled emails whose send_at has passed.
 * Called by Vercel cron at 6:00 and 7:00 UTC (8:00 AM Madrid in summer/winter).
 */
export async function GET() {
  const supabase = createServiceClient() as any;

  const { data: pending, error } = await supabase
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at")
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of pending as any[]) {
    try {
      const options = deserializeEmailPayload(row.payload);
      await sendEmail(options);

      await supabase
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error: msg })
        .eq("id", row.id);

      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
