import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/crm/utm
 *
 * Public endpoint called from Webflow form script to attach UTM data to a lead.
 * The Webflow webhook creates the lead, then this endpoint (called with a small delay)
 * matches by email and upserts UTM tracking data.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const email = (payload.email || "").toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ ok: false, reason: "missing_email" }, { status: 400 });
    }

    const utmFields = {
      utm_source: payload.utm_source || null,
      utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null,
      utm_term: payload.utm_term || null,
      utm_content: payload.utm_content || null,
      gclid: payload.gclid || null,
      fbclid: payload.fbclid || null,
      msclkid: payload.msclkid || null,
      ttclid: payload.ttclid || null,
      referrer: payload.referrer || null,
      landing_page: payload.landing_page || null,
      current_page: payload.current_page || null,
      first_touch_page: payload.first_touch_page || null,
      first_touch_referrer: payload.first_touch_referrer || null,
      first_touch_timestamp: payload.first_touch_timestamp || null,
      last_touch_timestamp: payload.last_touch_timestamp || null,
      session_id: payload.session_id || null,
    };

    const hasData = utmFields.utm_source || utmFields.utm_medium || utmFields.utm_campaign ||
      utmFields.gclid || utmFields.fbclid || utmFields.msclkid || utmFields.ttclid || utmFields.referrer;

    if (!hasData) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_utm_data" });
    }

    const supabase = getSupabase();

    // Try to find lead by email, with a retry for timing (Webflow webhook may still be processing)
    let leadId: string | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lead) {
        leadId = lead.id;
        break;
      }

      // Wait 2 seconds before retrying
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!leadId) {
      return NextResponse.json({ ok: false, reason: "lead_not_found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("lead_utm_data")
      .upsert({ lead_id: leadId, ...utmFields }, { onConflict: "lead_id" });

    if (error) {
      console.error("UTM attach error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch (err) {
    console.error("UTM endpoint error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
