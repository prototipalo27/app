import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchNewEmails } from "@/lib/email-imap";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Read last synced UID
    const { data: meta } = await supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "last_email_sync_uid")
      .single();

    const lastUid = parseInt(meta?.value || "0", 10);

    const emails = await fetchNewEmails(lastUid);

    if (emails.length === 0) {
      return NextResponse.json({ synced: 0, message: "No new emails" });
    }

    let synced = 0;
    let highestUid = lastUid;

    for (const email of emails) {
      // Track highest UID
      if (email.uid > highestUid) highestUid = email.uid;

      // Find lead by sender email
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", email.from)
        .limit(1)
        .single();

      if (!lead) continue; // No matching lead, skip

      // Insert activity (unique index on message_id prevents duplicates)
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "email_received",
        content: email.body,
        metadata: {
          message_id: email.messageId,
          email_from: email.from,
          email_from_name: email.fromName,
          email_subject: email.subject,
          in_reply_to: email.inReplyTo,
          imap_uid: email.uid,
        },
        created_at: email.date.toISOString(),
        created_by: null,
      });

      if (error) {
        // 23505 = unique_violation (duplicate message_id) — skip silently
        if (error.code === "23505") continue;
        console.error("Error inserting email activity:", error);
        continue;
      }

      synced++;
    }

    // Update last synced UID
    if (highestUid > lastUid) {
      await supabase
        .from("app_metadata")
        .update({ value: String(highestUid), updated_at: new Date().toISOString() })
        .eq("key", "last_email_sync_uid");
    }

    return NextResponse.json({ synced, total_fetched: emails.length });
  } catch (err) {
    console.error("Email sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
